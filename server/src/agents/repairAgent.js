import { REPAIR_SYSTEM, repairPrompt } from './prompts/repair.js';

/** Returns only the changed/added files; the orchestrator merges them into the project. */
export async function runRepairAgent(llm, ctx) {
  return llm.generateFiles({
    stage: 'repair',
    system: REPAIR_SYSTEM,
    prompt: repairPrompt(ctx),
  });
}
