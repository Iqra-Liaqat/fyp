// Which stages each experimental condition runs. The orchestrator reads this; it contains no if/else per condition.
// Security guards (path/import allowlist) run in EVERY condition: they are safety, not an experimental variable.
// The planner is identical in all conditions (same plan + same checks given to the coding agent), so the only
// manipulated variable is the validation/repair machinery.
const FRONT = ['requirements', 'scope_gate', 'planning', 'code_generation'];

export const PIPELINE_PROFILES = {
  baseline: { stages: [...FRONT, 'build'], repair: null },
  proposed: {
    stages: [...FRONT, 'static_validation', 'build', 'smoke_test', 'acceptance_test'],
    repair: { mode: 'targeted_feedback' },
  },
  blind_retry: { stages: [...FRONT, 'build'], repair: { mode: 'regenerate_without_feedback' } },
};

export function getPipelineProfile(condition) {
  const profile = PIPELINE_PROFILES[condition];
  if (!profile) throw new Error(`Unknown experiment condition: ${condition}`);
  return profile;
}
