import { LlmError } from './errors.js';

/** Pulls a JSON object out of model text: handles ```json fences and chatter around the object. */
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new LlmError('LLM_INVALID_JSON', 'No JSON object found in model output');
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch (e) {
    throw new LlmError('LLM_INVALID_JSON', `Model output is not valid JSON: ${e.message}`);
  }
}

export function formatZodIssues(error) {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}
