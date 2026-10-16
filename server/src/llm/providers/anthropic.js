import { LlmError } from '../errors.js';

/** Anthropic Messages API adapter (plain fetch, no SDK). */
export function createAnthropicProvider(config) {
  const baseUrl = (config.LLM_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
  return {
    name: 'anthropic',
    async complete({ model, system, messages, temperature, maxTokens = 8192, tools, signal }) {
      if (!model) throw new LlmError('LLM_NOT_CONFIGURED', 'No model set. Configure LLM_MODEL_PLANNER / LLM_MODEL_CODER in .env.');
      const body = { model, max_tokens: maxTokens, system, messages };
      if (temperature !== null && temperature !== undefined) body.temperature = temperature;
      if (tools?.length) body.tools = tools;
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': config.LLM_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 400);
        const hint = res.status === 401 ? ' (check LLM_API_KEY)' : res.status === 429 ? ' (rate limited, retry shortly)' : '';
        throw new LlmError('LLM_PROVIDER_ERROR', `Anthropic API ${res.status}${hint}: ${detail}`);
      }
      const data = await res.json();
      const blocks = data.content ?? [];
      return {
        text: blocks.filter((b) => b.type === 'text').map((b) => b.text).join(''),
        toolCalls: blocks.filter((b) => b.type === 'tool_use').map((b) => ({ name: b.name, input: b.input })),
        usage: { input_tokens: data.usage?.input_tokens ?? 0, output_tokens: data.usage?.output_tokens ?? 0 },
        stop_reason: data.stop_reason,
      };
    },
  };
}
