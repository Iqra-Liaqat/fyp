import { GeneratedFileSchema, GeneratedProjectSchema } from '@fyp/shared';
import { LlmError } from './errors.js';
import { extractJson, formatZodIssues } from './structuredOutput.js';

/**
 * Provider contract (all a provider has to implement):
 *   provider.name
 *   provider.complete({ model, system, messages, temperature, maxTokens, signal, tools? })
 *     -> { text, toolCalls: [{name, input}], usage: {input_tokens, output_tokens} }
 * The pipeline only talks to this client, so swapping providers is a config change.
 */

export const WRITE_FILE_TOOL = {
  name: 'write_file',
  description: 'Write one project file. Paths must be inside src/.',
  input_schema: {
    type: 'object',
    properties: { path: { type: 'string' }, content: { type: 'string' } },
    required: ['path', 'content'],
  },
};

function stripFence(s) {
  const m = s.trim().match(/^```[a-zA-Z]*\r?\n([\s\S]*?)\r?\n```$/);
  return m ? m[1] : s;
}

/** Files are emitted as <file path="src/App.jsx">...</file> blocks: no JSON escaping, works with any provider. */
export function parseFileBlocks(text) {
  const files = [];
  const re = /<file\s+path="([^"]+)"\s*>\r?\n?([\s\S]*?)<\/file>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    files.push({ path: m[1].trim(), content: stripFence(m[2]).replace(/\s+$/, '') + '\n' });
  }
  const opened = (text.match(/<file\s+path=/g) || []).length;
  return { files, truncated: opened !== files.length };
}

export function createLlmClient({ provider, config }) {
  const usage = { calls: 0, input_tokens: 0, output_tokens: 0 };

  async function call(request) {
    if (!config.llmConfigured) {
      throw new LlmError('LLM_NOT_CONFIGURED', 'No LLM API key configured. Set LLM_API_KEY in .env and restart the server.');
    }
    const timeoutMs = request.timeoutMs ?? config.LLM_TIMEOUT_MS;
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new LlmError('LLM_TIMEOUT', `LLM call exceeded ${Math.round(timeoutMs / 1000)} s`));
      }, timeoutMs);
    });
    let res;
    try {
      res = await Promise.race([
        provider.complete({ temperature: config.LLM_TEMPERATURE, ...request, signal: controller.signal }),
        timeout,
      ]);
    } catch (e) {
      if (e instanceof LlmError) throw e;
      throw new LlmError('LLM_PROVIDER_ERROR', e.message, { cause: String(e) });
    } finally {
      clearTimeout(timer);
    }
    usage.calls += 1;
    usage.input_tokens += res?.usage?.input_tokens ?? 0;
    usage.output_tokens += res?.usage?.output_tokens ?? 0;
    return { text: res?.text ?? '', toolCalls: res?.toolCalls ?? [], usage: res?.usage ?? {} };
  }

  /** JSON in, validated object out. Retries with the validation error fed back to the model. */
  async function generateStructured({ stage, system, prompt, schema, model, maxRetries = 1, maxTokens = 8192 }) {
    const messages = [{ role: 'user', content: prompt }];
    let lastError = new LlmError('LLM_EMPTY_RESPONSE', 'Model returned an empty response');
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const res = await call({ stage, kind: 'structured', model: model ?? config.LLM_MODEL_PLANNER, system, messages, maxTokens });
      if (!res.text.trim()) {
        lastError = new LlmError('LLM_EMPTY_RESPONSE', 'Model returned an empty response');
        continue;
      }
      let parsed;
      try {
        parsed = extractJson(res.text);
      } catch (e) {
        lastError = e;
        messages.push(
          { role: 'assistant', content: res.text },
          { role: 'user', content: `That was not valid JSON (${e.message}). Reply with ONLY the corrected JSON object.` },
        );
        continue;
      }
      const check = schema.safeParse(parsed);
      if (check.success) return { data: check.data, attempts: attempt + 1 };
      const issues = formatZodIssues(check.error);
      lastError = new LlmError('LLM_SCHEMA_MISMATCH', issues, { issues });
      messages.push(
        { role: 'assistant', content: res.text },
        { role: 'user', content: `The JSON did not match the required schema: ${issues}. Reply with ONLY the corrected JSON object.` },
      );
    }
    throw lastError;
  }

  async function generateText({ stage, system, prompt, model, maxTokens = 4096 }) {
    const res = await call({ stage, kind: 'text', model: model ?? config.LLM_MODEL_PLANNER, system, messages: [{ role: 'user', content: prompt }], maxTokens });
    if (!res.text.trim()) throw new LlmError('LLM_EMPTY_RESPONSE', 'Model returned an empty response');
    return { text: res.text };
  }

  /** Returns validated files (safe paths, size caps). Used by the coding agent (all files) and repair agent (changed files). */
  async function generateFiles({ stage, system, prompt, model, maxTokens = 16000, maxRetries = 1, requiredPaths = [] }) {
    const messages = [{ role: 'user', content: prompt }];
    let lastError = new LlmError('LLM_EMPTY_RESPONSE', 'Model produced no files');
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const res = await call({
        stage,
        kind: 'code',
        model: model ?? config.LLM_MODEL_CODER,
        system,
        messages,
        maxTokens,
        timeoutMs: config.LLM_CODE_TIMEOUT_MS,
      });
      const { files: blocks, truncated } = parseFileBlocks(res.text);
      const byPath = new Map();
      for (const t of res.toolCalls) {
        if (t.name === 'write_file' && t.input && typeof t.input.path === 'string') {
          byPath.set(t.input.path, { path: t.input.path, content: String(t.input.content ?? '') });
        }
      }
      for (const f of blocks) byPath.set(f.path, f); // last write to a path wins

      let problem = null;
      let feedback = '';
      if (truncated) {
        problem = new LlmError('LLM_TRUNCATED', 'Model output was cut off before the last file finished');
        feedback = 'Your output was cut off. Reply again with the complete set of files, written more compactly (shorter CSS, fewer files).';
      } else if (byPath.size === 0) {
        problem = new LlmError('LLM_EMPTY_RESPONSE', 'Model produced no files');
        feedback = 'You produced no <file path="..."> blocks. Reply again using only <file> blocks.';
      } else {
        const valid = [];
        const issues = [];
        for (const f of byPath.values()) {
          const check = GeneratedFileSchema.safeParse(f);
          if (check.success) valid.push(check.data);
          else issues.push(`${f.path}: ${formatZodIssues(check.error)}`);
        }
        const missing = requiredPaths.filter((p) => !byPath.has(p));
        if (missing.length) issues.push(`missing required file(s): ${missing.join(', ')}`);
        if (issues.length) {
          problem = new LlmError('LLM_SCHEMA_MISMATCH', issues.join('; '), { issues });
          feedback = `Problems with your files: ${issues.join('; ')}. Reply again using only <file path="..."> blocks.`;
        } else {
          return { files: valid };
        }
      }
      lastError = problem;
      messages.push({ role: 'assistant', content: res.text || '(empty)' }, { role: 'user', content: feedback });
    }
    throw lastError;
  }

  async function generateCode({ stage, system, prompt, projectName, model, maxTokens }) {
    const { files } = await generateFiles({ stage, system, prompt, model, maxTokens, requiredPaths: ['src/App.jsx'] });
    const check = GeneratedProjectSchema.safeParse({ project_name: projectName, files });
    if (!check.success) throw new LlmError('LLM_SCHEMA_MISMATCH', formatZodIssues(check.error));
    return { project: check.data };
  }

  return { generateStructured, generateText, generateFiles, generateCode, usage, providerName: provider.name };
}
