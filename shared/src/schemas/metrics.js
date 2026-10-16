import { z } from 'zod';
import { EXPERIMENT_CONDITIONS, RUN_MODES } from '../constants.js';
import { RUN_OUTCOMES } from './run.js';

const ms = z.number().int().min(0);

// One row per generation. Written incrementally so a crashed run still leaves data.
export const MetricsRecordSchema = z.object({
  run_id: z.string(),
  benchmark_item_id: z.string().nullable(),
  trial: z.number().int().nullable(),
  condition: z.enum(EXPERIMENT_CONDITIONS),
  mode: z.enum(RUN_MODES),
  provider: z.string(),
  model_planner: z.string(),
  model_coder: z.string(),
  temperature: z.number(),
  project_type: z.string().nullable(),

  // Requirements
  features_requested: z.number().int().nullable(),
  requirement_extraction_f1: z.number().min(0).max(1).nullable(), // vs benchmark ground truth
  requirement_plan_consistency: z.number().min(0).max(1).nullable(), // features with >=1 planner check / features

  // Build
  initial_build_success: z.boolean().nullable(), // first generated code, before any repair
  final_build_success: z.boolean(),
  static_violations_initial: z.number().int().nullable(),
  repair_attempts: z.number().int().min(0),
  repair_succeeded: z.boolean().nullable(), // null when no repair was needed

  // Tests
  planner_checks_total: z.number().int().nullable(),
  planner_checks_passed: z.number().int().nullable(),
  heldout_checks_total: z.number().int().nullable(),
  heldout_checks_passed: z.number().int().nullable(),
  feature_completion_rate: z.number().min(0).max(1).nullable(), // scored on HELD-OUT checks
  smoke_test_passed: z.boolean().nullable(),

  // Cost / time
  total_ms: ms,
  stage_ms: z.record(z.string(), ms),
  llm_calls: z.number().int(),
  tokens_in: z.number().int(),
  tokens_out: z.number().int(),

  // Outcome
  outcome: z.enum(RUN_OUTCOMES),
  failure_stage: z.string().nullable(),
  failure_code: z.string().nullable(),

  // Filled later by human raters (blind to condition)
  human_rating: z
    .object({
      functionality: z.number().min(1).max(5),
      ui_quality: z.number().min(1).max(5),
      requirement_fit: z.number().min(1).max(5),
      overall: z.number().min(1).max(5),
      rater_id: z.string(),
    })
    .nullable()
    .default(null),
});
