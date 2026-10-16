import { CODING_SYSTEM, codingPrompt, collectTestIds } from './prompts/coding.js';

export async function runCodingAgent(llm, spec, plan) {
  return llm.generateCode({
    stage: 'code_generation',
    system: CODING_SYSTEM,
    prompt: codingPrompt(spec, plan, collectTestIds(plan)),
    projectName: spec.project_name,
  });
}
