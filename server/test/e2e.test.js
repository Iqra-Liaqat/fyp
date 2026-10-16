import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../src/config/env.js';
import { createRunStore } from '../src/storage/runStore.js';
import { createEventBus } from '../src/events/eventBus.js';
import { createLlmClient } from '../src/llm/llmClient.js';
import { createMockProvider } from '../src/llm/providers/mock.js';
import { createWorkspace } from '../src/workspace/workspaceManager.js';
import { createBuilder } from '../src/validation/buildRunner.js';
import { createOrchestrator } from '../src/pipeline/orchestrator.js';
import { createPreviewServer } from '../src/preview/previewServer.js';
import { createInitialRunRecord } from '../src/pipeline/runFactory.js';
import { runStaticChecks } from '../src/validation/staticChecks.js';
import { requirementsJson, planJson, codeWithBuildError, repairFix } from './fixtures/taskManager.js';

let tmp, config, store, workspace, ready, previewServer, previewPort;

before(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'fyp-e2e-'));
  config = loadConfig({ LLM_PROVIDER: 'mock', WORKSPACE_DIR: tmp, MAX_REPAIR_ATTEMPTS: '2' });
  store = createRunStore(tmp);
  workspace = createWorkspace(config);
  ready = await workspace.templateReady();
  previewServer = await new Promise((r) => { const s = createPreviewServer({ config }).listen(0, () => r(s)); });
  previewPort = previewServer.address().port;
});
after(async () => {
  previewServer.close();
  await fs.rm(tmp, { recursive: true, force: true });
});

function makeOrchestrator(responses) {
  const provider = createMockProvider({ responses });
  const bus = createEventBus({ persist: store.appendEvent });
  const llm = createLlmClient({ provider, config });
  return { provider, orchestrator: createOrchestrator({ store, bus, llm, config, workspace, builder: createBuilder({ workspace, config }) }) };
}
const newRun = async (condition = 'proposed') =>
  store.save(createInitialRunRecord({ input: { kind: 'manual', text: 'Create a student task management web application' }, mode: 'live', condition }));

test('full pipeline: requirements -> plan -> code -> build error -> AI repair -> build -> live preview', { skip: !process.env.CI && false }, async (t) => {
  if (!ready) return t.skip('run "npm run setup" first');
  const { provider, orchestrator } = makeOrchestrator([requirementsJson, planJson, codeWithBuildError, repairFix]);
  const run = await newRun();
  await orchestrator.start(run.id);
  const done = await store.get(run.id);

  assert.equal(done.status, 'PREVIEW_READY', done.error?.message);
  assert.equal(done.outcome, 'success_after_repair');
  assert.equal(done.requirements.features.length, 4);
  assert.equal(done.plan.acceptance_checks.length, 4);
  assert.equal(done.repair_attempts.length, 1);
  assert.equal(done.repair_attempts[0].trigger, 'build_error');
  assert.equal(done.repair_attempts[0].succeeded, true);
  assert.deepEqual(done.repair_attempts[0].files_changed, ['src/components/TaskList.jsx']);
  assert.equal(done.stages.smoke_test.status, 'skipped');
  assert.equal(provider.calls.length, 4);
  assert.match(provider.calls[3].messages[0].content, /BUILD ERROR OUTPUT/);
  assert.match(provider.calls[2].messages[0].content, /"task-input"/); // testid contract reaches the coder

  const res = await fetch(`http://127.0.0.1:${previewPort}${done.preview.url}`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<title>Student Task Manager<\/title>/);
  const js = html.match(/src="\.\/(assets\/[^"]+\.js)"/)[1];
  const bundle = await (await fetch(`http://127.0.0.1:${previewPort}${done.preview.url}${js}`)).text();
  assert.match(bundle, /Student Task Manager/);
  assert.match(res.headers.get('content-security-policy'), /connect-src 'none'/);
});

test('baseline condition has no repair loop: the same build error ends the run as FAILED', async (t) => {
  if (!ready) return t.skip('run "npm run setup" first');
  const { orchestrator } = makeOrchestrator([requirementsJson, planJson, codeWithBuildError]);
  const run = await newRun('baseline');
  await orchestrator.start(run.id);
  const done = await store.get(run.id);
  assert.equal(done.status, 'FAILED');
  assert.equal(done.outcome, 'failed');
  assert.equal(done.error.code, 'BUILD_FAILED');
  assert.equal(done.repair_attempts.length, 0);
});

test('repair attempts are capped and the failure is reported honestly', async (t) => {
  if (!ready) return t.skip('run "npm run setup" first');
  const { orchestrator } = makeOrchestrator([requirementsJson, planJson, codeWithBuildError, codeWithBuildError, codeWithBuildError]);
  const run = await newRun();
  await orchestrator.start(run.id);
  const done = await store.get(run.id);
  assert.equal(done.status, 'FAILED');
  assert.equal(done.repair_attempts.length, 2);
  assert.equal(done.repair_attempts.at(-1).succeeded, false);
});

test('out-of-scope request is rejected with the simplified-prototype message and never reaches the coder', async () => {
  const rejected = JSON.stringify({ ...JSON.parse(requirementsJson), project_type: 'unsupported', out_of_scope_signals: ['real payment processing'] });
  const { provider, orchestrator } = makeOrchestrator([rejected]);
  const run = await newRun();
  await orchestrator.start(run.id);
  const done = await store.get(run.id);
  assert.equal(done.status, 'REJECTED_OUT_OF_SCOPE');
  assert.match(done.scope.simplified_suggestion, /outside the supported MVP scope/);
  assert.equal(provider.calls.length, 1);
});

test('LLM failure (no key) ends the run as FAILED with a readable error, not a crash', async () => {
  const noKey = loadConfig({ LLM_PROVIDER: 'anthropic', WORKSPACE_DIR: tmp });
  const bus = createEventBus();
  const llm = createLlmClient({ provider: createMockProvider(), config: noKey });
  const orchestrator = createOrchestrator({ store, bus, llm, config: noKey, workspace, builder: createBuilder({ workspace, config: noKey }) });
  const run = await newRun();
  await orchestrator.start(run.id);
  const done = await store.get(run.id);
  assert.equal(done.status, 'FAILED');
  assert.equal(done.error.code, 'LLM_NOT_CONFIGURED');
  assert.equal(done.error.stage, 'requirements');
});

test('static checks catch banned patterns, disallowed and missing imports', () => {
  const v = runStaticChecks([
    { path: 'src/App.jsx', content: "import axios from 'axios';\nimport X from './Missing.jsx';\nimport './App.css';\nfetch('/x');\n" },
    { path: 'src/App.css', content: 'body{}' },
  ]);
  assert.deepEqual(v.map((x) => x.rule).sort(), ['import_not_allowed', 'missing_file', 'network']);
  assert.deepEqual(runStaticChecks([{ path: 'src/App.jsx', content: "import { useState } from 'react';\nimport './App.css';\n" }, { path: 'src/App.css', content: '' }]), []);
});
