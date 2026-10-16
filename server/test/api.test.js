import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../src/config/env.js';
import { createRunStore } from '../src/storage/runStore.js';
import { createEventBus } from '../src/events/eventBus.js';
import { createApp } from '../src/app.js';
import { createInitialRunRecord } from '../src/pipeline/runFactory.js';
import { transition } from '../src/pipeline/runStateMachine.js';

let server, base, tmp;

before(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'fyp-'));
  const config = loadConfig({ LLM_PROVIDER: 'mock', WORKSPACE_DIR: tmp });
  const store = createRunStore(config.workspaceDir);
  const bus = createEventBus({ persist: store.appendEvent });
  const app = createApp({ config, store, bus, orchestrator: { start: async () => {} } });
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  server.close();
  await fs.rm(tmp, { recursive: true, force: true });
});

const post = (url, body) =>
  fetch(base + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('health and config never leak secrets', async () => {
  const health = await (await fetch(base + '/health')).json();
  assert.equal(health.status, 'ok');
  const cfg = await (await fetch(base + '/config')).json();
  assert.equal(cfg.supported_project_types.length, 10);
  assert.equal(JSON.stringify(cfg).includes('LLM_API_KEY'), false);
});

test('demos endpoint returns the three official scenarios', async () => {
  const { scenarios } = await (await fetch(base + '/demos')).json();
  assert.equal(scenarios.length, 3);
});

test('create run: invalid body -> 400 with readable message', async () => {
  const res = await post('/runs', { input: { kind: 'manual', text: 'short' } });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_REQUEST');
});

test('create, fetch and list a run; baseline skips validation stages', async () => {
  const res = await post('/runs', { input: { kind: 'manual', text: 'Create a simple student task manager' }, condition: 'baseline' });
  assert.equal(res.status, 201);
  const { run } = await res.json();
  assert.equal(run.status, 'CREATED');
  assert.equal(run.stages.static_validation.status, 'skipped');
  assert.equal(run.stages.repair.status, 'skipped');
  assert.equal(run.stages.build.status, 'pending');

  assert.equal((await (await fetch(`${base}/runs/${run.id}`)).json()).run.id, run.id);
  const list = await (await fetch(base + '/runs')).json();
  assert.ok(list.runs.some((r) => r.id === run.id));
});

test('path-traversal run ids and unknown runs are rejected', async () => {
  assert.equal((await fetch(base + '/runs/..%2F..%2Fetc')).status, 400);
  assert.equal((await fetch(base + '/runs/run_abc_123456')).status, 404);
  assert.equal((await fetch(base + '/nope')).status, 404);
});

test('SSE replays persisted events', async () => {
  const { run } = await (await post('/runs', { input: { kind: 'manual', text: 'Create a restaurant website with a menu' } })).json();
  await new Promise((r) => setTimeout(r, 100));
  const ctl = new AbortController();
  const res = await fetch(`${base}/runs/${run.id}/events`, { signal: ctl.signal });
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  const reader = res.body.getReader();
  const { value } = await reader.read();
  assert.match(new TextDecoder().decode(value), /event: status/);
  ctl.abort();
});

test('state machine rejects illegal transitions and allows legal ones', () => {
  const run = createInitialRunRecord({ input: { kind: 'manual', text: 'x'.repeat(12) }, mode: 'live', condition: 'proposed' });
  assert.throws(() => transition(run, 'BUILDING'), { code: 'INVALID_TRANSITION' });
  assert.equal(transition(run, 'EXTRACTING_REQUIREMENTS').status, 'EXTRACTING_REQUIREMENTS');
});
