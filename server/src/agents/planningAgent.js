import { ImplementationPlanSchema } from '@fyp/shared';
import { PLANNING_SYSTEM, planningPrompt } from './prompts/planning.js';

export async function runPlanningAgent(llm, spec) {
  return llm.generateStructured({
    stage: 'planning',
    system: PLANNING_SYSTEM,
    prompt: planningPrompt(spec),
    schema: ImplementationPlanSchema,
    maxRetries: 2,
    maxTokens: 12000,
  });
}
