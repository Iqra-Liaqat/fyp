import { RULES } from './coding.js';

export const REPAIR_SYSTEM = `You are the Repair Agent of an AI software house. You fix a generated React project that failed validation or build.
You output ONLY <file path="..."> blocks (full content of every file you change or add), no explanations and no markdown fences.`;

export function repairPrompt({ spec, files, errorText, trigger, attempt, maxAttempts }) {
  const listing = files.map((f) => `<file path="${f.path}">\n${f.content}</file>`).join('\n');
  const what = trigger === 'static_violation' ? 'STATIC VALIDATION VIOLATIONS' : 'BUILD ERROR OUTPUT';
  return `The project below failed (repair attempt ${attempt} of ${maxAttempts}). Fix the root cause, keep all working features, and do not redesign anything.

PROJECT: ${spec.project_name} (${spec.project_type})

${what}:
${errorText.slice(0, 6000)}

CURRENT FILES:
${listing}

Return ONLY the files that must change or be added, each with its COMPLETE new content. If an import points to a missing file, create that file (or fix the import).

${RULES}`;
}
