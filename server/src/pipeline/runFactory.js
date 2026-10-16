import crypto from 'node:crypto';
import { STAGES, getPipelineProfile } from '@fyp/shared';

export function newRunId() {
  return `run_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

/** Builds the initial record. Stages not in the condition's profile start as "skipped". */
export function createInitialRunRecord(request, now = new Date()) {
  const profile = getPipelineProfile(request.condition);
  const ts = now.toISOString();
  const stages = {};
  for (const stage of STAGES) {
    const active = profile.stages.includes(stage) || (stage === 'repair' && profile.repair) || stage === 'preview';
    stages[stage] = {
      status: active ? 'pending' : 'skipped',
      started_at: null,
      finished_at: null,
      duration_ms: null,
      message: null,
      error: null,
    };
  }
  return {
    id: newRunId(),
    created_at: ts,
    updated_at: ts,
    status: 'CREATED',
    outcome: null,
    mode: request.mode,
    condition: request.condition,
    benchmark: request.benchmark ?? null,
    input: request.input,
    requirements: null,
    scope: null,
    plan: null,
    files: [],
    stages,
    repair_attempts: [],
    test_reports: [],
    preview: null,
    error: null,
  };
}
