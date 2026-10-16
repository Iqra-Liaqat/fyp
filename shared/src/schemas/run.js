import { z } from 'zod';
import { EXPERIMENT_CONDITIONS, RUN_MODES, SCHEMA_VERSION, STAGES } from '../constants.js';
import { InputPayloadSchema } from './input.js';
import { RequirementSpecSchema } from './requirement.js';
import { ScopeDecisionSchema } from './scope.js';
import { ImplementationPlanSchema } from './plan.js';

// ---------- Run-state model ----------
export const RUN_STATUSES = [
  'CREATED',
  'EXTRACTING_REQUIREMENTS',
  'CHECKING_SCOPE',
  'PLANNING',
  'GENERATING_CODE',
  'VALIDATING_STATIC',
  'BUILDING',
  'TESTING',
  'REPAIRING',
  'PREVIEW_READY',
  'FAILED',
  'REJECTED_OUT_OF_SCOPE',
  'CANCELLED',
];
export const TERMINAL_STATUSES = ['PREVIEW_READY', 'FAILED', 'REJECTED_OUT_OF_SCOPE', 'CANCELLED'];

export const ALLOWED_TRANSITIONS = {
  CREATED: ['EXTRACTING_REQUIREMENTS', 'FAILED', 'CANCELLED'],
  EXTRACTING_REQUIREMENTS: ['CHECKING_SCOPE', 'FAILED', 'CANCELLED'],
  CHECKING_SCOPE: ['PLANNING', 'REJECTED_OUT_OF_SCOPE', 'FAILED', 'CANCELLED'],
  PLANNING: ['GENERATING_CODE', 'FAILED', 'CANCELLED'],
  // baseline/blind_retry skip static validation and go straight to BUILDING
  GENERATING_CODE: ['VALIDATING_STATIC', 'BUILDING', 'FAILED', 'CANCELLED'],
  VALIDATING_STATIC: ['BUILDING', 'REPAIRING', 'FAILED', 'CANCELLED'],
  // baseline ends right after a successful build
  BUILDING: ['TESTING', 'REPAIRING', 'PREVIEW_READY', 'FAILED', 'CANCELLED'],
  TESTING: ['PREVIEW_READY', 'REPAIRING', 'FAILED', 'CANCELLED'],
  REPAIRING: ['VALIDATING_STATIC', 'BUILDING', 'FAILED', 'CANCELLED'],
  PREVIEW_READY: [],
  FAILED: [],
  REJECTED_OUT_OF_SCOPE: [],
  CANCELLED: [],
};

export const canTransition = (from, to) => (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
export const isTerminal = (status) => TERMINAL_STATUSES.includes(status);

// Honest end states. PREVIEW_READY + outcome "partial" = it builds and previews, but some acceptance checks still fail.
export const RUN_OUTCOMES = [
  'success_first_try',
  'success_after_repair',
  'partial',
  'failed',
  'rejected',
  'cancelled',
];

// ---------- Records ----------
export const ErrorInfoSchema = z.object({
  code: z.string().max(60),
  message: z.string().max(2000),
  stage: z.enum(STAGES).optional(),
});

export const StageRecordSchema = z.object({
  status: z.enum(['pending', 'running', 'succeeded', 'failed', 'skipped']).default('pending'),
  started_at: z.string().nullable().default(null),
  finished_at: z.string().nullable().default(null),
  duration_ms: z.number().nullable().default(null),
  message: z.string().max(500).nullable().default(null),
  error: ErrorInfoSchema.nullable().default(null),
});

export const RepairAttemptSchema = z.object({
  attempt: z.number().int().min(1),
  trigger: z.enum(['static_violation', 'build_error', 'smoke_failure', 'acceptance_failure']),
  error_summary: z.string().max(4000),
  files_changed: z.array(z.string()).default([]),
  succeeded: z.boolean().nullable().default(null), // null while in progress
  duration_ms: z.number().nullable().default(null),
});

export const CheckResultSchema = z.object({
  check_id: z.string(),
  passed: z.boolean(),
  detail: z.string().max(500).optional(),
});

// suite "planner" runs inside the pipeline (demo + repair feedback);
// suite "heldout" is run only by the evaluation harness and never fed back to any agent.
export const TestReportSchema = z.object({
  suite: z.enum(['planner', 'heldout']),
  total: z.number().int().min(0),
  passed: z.number().int().min(0),
  results: z.array(CheckResultSchema),
});

export const RunRecordSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  id: z.string().regex(/^run_[a-z0-9]+_[a-f0-9]{6}$/),
  created_at: z.string(),
  updated_at: z.string(),
  status: z.enum(RUN_STATUSES),
  outcome: z.enum(RUN_OUTCOMES).nullable().default(null),
  mode: z.enum(RUN_MODES),
  condition: z.enum(EXPERIMENT_CONDITIONS),
  benchmark: z.object({ item_id: z.string(), trial: z.number().int() }).nullable().default(null),
  input: InputPayloadSchema,
  requirements: RequirementSpecSchema.nullable().default(null),
  scope: ScopeDecisionSchema.nullable().default(null),
  plan: ImplementationPlanSchema.nullable().default(null),
  files: z.array(z.object({ path: z.string(), bytes: z.number().int() })).default([]),
  stages: z.record(z.string(), StageRecordSchema),
  repair_attempts: z.array(RepairAttemptSchema).default([]),
  test_reports: z.array(TestReportSchema).default([]),
  preview: z.object({ url: z.string(), built_at: z.string() }).nullable().default(null),
  error: ErrorInfoSchema.nullable().default(null),
});

export const RunSummarySchema = RunRecordSchema.pick({
  id: true,
  created_at: true,
  status: true,
  outcome: true,
  mode: true,
  condition: true,
}).extend({ project_name: z.string().nullable() });
