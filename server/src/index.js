import fs from 'node:fs/promises';
import { loadConfig, loadDotenv } from './config/env.js';
import { createRunStore } from './storage/runStore.js';
import { createEventBus } from './events/eventBus.js';
import { createLlmClient } from './llm/llmClient.js';
import { createProvider } from './llm/providers/index.js';
import { createWorkspace } from './workspace/workspaceManager.js';
import { createBuilder } from './validation/buildRunner.js';
import { createOrchestrator } from './pipeline/orchestrator.js';
import { createPreviewServer } from './preview/previewServer.js';
import { createApp } from './app.js';

loadDotenv();
const config = loadConfig();
await fs.mkdir(config.workspaceDir, { recursive: true });

const store = createRunStore(config.workspaceDir);
const bus = createEventBus({ persist: store.appendEvent });
const llm = createLlmClient({ provider: createProvider(config), config });
const workspace = createWorkspace(config);
const builder = createBuilder({ workspace, config });
const orchestrator = createOrchestrator({ store, bus, llm, config, workspace, builder });
const app = createApp({ config, store, bus, orchestrator, workspace });

app.listen(config.PORT, () => console.log(`[api]     http://localhost:${config.PORT}`));
createPreviewServer({ config }).listen(config.PREVIEW_PORT, () => console.log(`[preview] http://localhost:${config.PREVIEW_PORT}/preview/<run-id>/`));

console.log(`[llm]     provider=${config.LLM_PROVIDER} configured=${config.llmConfigured} planner=${config.LLM_MODEL_PLANNER || '-'} coder=${config.LLM_MODEL_CODER || '-'}`);
if (!config.llmConfigured) console.warn('[llm]     No LLM_API_KEY set: copy .env.example to .env and add your key.');
if (!(await workspace.templateReady())) console.warn('[setup]   Template dependencies missing: run "npm run setup" once.');
