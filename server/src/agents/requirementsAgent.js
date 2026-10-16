import { RequirementSpecSchema } from '@fyp/shared';
import { REQUIREMENTS_SYSTEM, requirementsPrompt } from './prompts/requirements.js';

/** Accepts all three input kinds. Structured drafts are completed/validated by the model, not trusted blindly. */
export async function runRequirementsAgent(llm, input) {
  const text =
    input.kind === 'structured'
      ? `A structured (possibly incomplete) requirement draft from an upstream agent:\n${JSON.stringify(input.requirements, null, 2)}`
      : input.text;
  return llm.generateStructured({
    stage: 'requirements',
    system: REQUIREMENTS_SYSTEM,
    prompt: requirementsPrompt(text),
    schema: RequirementSpecSchema,
    maxRetries: 2,
  });
}
