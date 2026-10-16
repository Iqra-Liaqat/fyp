import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { loadConfig } from '../src/config/env.js';
import { createLlmClient } from '../src/llm/llmClient.js';
import { createMockProvider } from '../src/llm/providers/mock.js';
import { extractJson } from '../src/llm/structuredOutput.js';
import { createProvider } from '../src/llm/providers/index.js';

const config = loadConfig({ LLM_PROVIDER: 'mock', LLM_TIMEOUT_MS: '200' });
const Schema = z.object({ name: z.string(), n: z.number() });

test('extractJson handles fences and surrounding chatter', () => {
  assert.deepEqual(extractJson('Sure!\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('here: {"a":2} thanks'), { a: 2 });
  assert.throws(() => extractJson('no json'), { code: 'LLM_INVALID_JSON' });
});

test('generateStructured retries once with schema feedback, then succeeds', async () => {
  const provider = createMockProvider({ responses: ['{"name":"x"}', '{"name":"x","n":3}'] });
  const llm = createLlmClient({ provider, config });
  const { data, attempts } = await llm.generateStructured({ stage: 'requirements', system: 's', prompt: 'p', schema: Schema });
  assert.deepEqual(data, { name: 'x', n: 3 });
  assert.equal(attempts, 2);
  assert.match(provider.calls[1].messages.at(-1).content, /schema/);
});

test('generateStructured gives up with a typed error after retries', async () => {
  const llm = createLlmClient({ provider: createMockProvider({ responses: ['nope', 'still nope'] }), config });
  await assert.rejects(() => llm.generateStructured({ stage: 'x', system: 's', prompt: 'p', schema: Schema }), { code: 'LLM_INVALID_JSON' });
});

test('empty responses are reported, not crashed on', async () => {
  const llm = createLlmClient({ provider: createMockProvider({ responses: ['', ''] }), config });
  await assert.rejects(() => llm.generateStructured({ stage: 'x', system: 's', prompt: 'p', schema: Schema }), { code: 'LLM_EMPTY_RESPONSE' });
});

test('timeout is enforced', async () => {
  const slow = createMockProvider({ responses: [() => new Promise((r) => setTimeout(() => r('{}'), 1000))] });
  const llm = createLlmClient({ provider: slow, config });
  await assert.rejects(() => llm.generateText({ stage: 'x', system: 's', prompt: 'p' }), { code: 'LLM_TIMEOUT' });
});

test('missing API key is a clear, typed error (server still boots)', async () => {
  const cfg = loadConfig({ LLM_PROVIDER: 'anthropic' });
  assert.equal(cfg.llmConfigured, false);
  const llm = createLlmClient({ provider: createProvider(cfg), config: cfg });
  await assert.rejects(() => llm.generateText({ stage: 'x', system: 's', prompt: 'p' }), { code: 'LLM_NOT_CONFIGURED' });
});

test('generateCode collects write_file calls, last write wins, and validates paths', async () => {
  const tc = (path, content) => ({ name: 'write_file', input: { path, content } });
  const ok = createMockProvider({ responses: [{ toolCalls: [tc('src/App.jsx', 'a'), tc('src/App.jsx', 'b'), tc('src/x.css', 'c')] }] });
  const { project } = await createLlmClient({ provider: ok, config }).generateCode({ stage: 'code_generation', system: 's', prompt: 'p', projectName: 'P' });
  assert.equal(project.files.length, 2);
  assert.equal(project.files.find((f) => f.path === 'src/App.jsx').content, 'b');

  const evilCall = { toolCalls: [tc('../../.env', 'x'), tc('src/App.jsx', 'a')] };
  const evil = createMockProvider({ responses: [evilCall, evilCall] });
  await assert.rejects(
    () => createLlmClient({ provider: evil, config }).generateCode({ stage: 'code_generation', system: 's', prompt: 'p', projectName: 'P' }),
    { code: 'LLM_SCHEMA_MISMATCH' },
  );
});

test('usage is accumulated', async () => {
  const provider = createMockProvider({ responses: [{ text: 'hi', usage: { input_tokens: 10, output_tokens: 5 } }] });
  const llm = createLlmClient({ provider, config });
  await llm.generateText({ stage: 'x', system: 's', prompt: 'p' });
  assert.deepEqual(llm.usage, { calls: 1, input_tokens: 10, output_tokens: 5 });
});
