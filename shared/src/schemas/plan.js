import { z } from 'zod';
import { SCHEMA_VERSION } from '../constants.js';
import { SafePathSchema } from './project.js';

// Locator contract: the coding agent must put data-testid on anything a check targets.
export const LocatorSchema = z.object({
  by: z.enum(['testid', 'role', 'text', 'label']),
  value: z.string().min(1).max(100),
  name: z.string().max(100).optional(), // accessible name, for by=role
});

export const StepSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('goto'), path: z.string().max(100).default('/') }),
  z.object({ action: z.literal('reload') }),
  z.object({ action: z.literal('click'), target: LocatorSchema }),
  z.object({ action: z.literal('check'), target: LocatorSchema }),
  z.object({ action: z.literal('fill'), target: LocatorSchema, value: z.string().max(200) }),
  z.object({ action: z.literal('select'), target: LocatorSchema, value: z.string().max(100) }),
  z.object({ action: z.literal('expect_visible'), target: LocatorSchema }),
  z.object({ action: z.literal('expect_text'), target: LocatorSchema, text: z.string().max(200) }),
  z.object({
    action: z.literal('expect_count'),
    target: LocatorSchema,
    count: z.number().int().min(0).max(100),
    comparison: z.enum(['eq', 'gte']).default('gte'),
  }),
]);

export const AcceptanceCheckSchema = z.object({
  id: z.string().regex(/^C\d+$/, 'Check id must look like C1, C2, ...'),
  feature_id: z.string().regex(/^F\d+$/),
  description: z.string().min(1).max(200),
  kind: z.enum(['presence', 'interaction', 'validation', 'persistence', 'navigation']),
  steps: z.array(StepSchema).min(1).max(12),
});

export const ImplementationPlanSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  project_name: z.string().min(1).max(100),
  pages: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        title: z.string().min(1).max(80),
        route: z.string().max(60), // hash route, e.g. "#/menu" (no router dependency)
        purpose: z.string().max(200),
        components: z.array(z.string().max(60)).default([]),
      }),
    )
    .min(1)
    .max(8),
  components: z
    .array(z.object({ name: z.string().max(60), purpose: z.string().max(200), file: SafePathSchema }))
    .min(1)
    .max(20),
  functionality: z.array(z.string().max(200)).min(1).max(20),
  data_model: z
    .array(
      z.object({
        name: z.string().max(60),
        fields: z.array(z.string().max(60)).min(1),
        storage: z.enum(['mock', 'localStorage']),
      }),
    )
    .default([]),
  validation_rules: z.array(z.string().max(200)).default([]),
  file_plan: z.array(z.object({ path: SafePathSchema, purpose: z.string().max(200) })).min(1).max(25),
  tech: z
    .object({
      framework: z.literal('react'),
      language: z.literal('javascript'),
      styling: z.literal('css'),
    })
    .default({ framework: 'react', language: 'javascript', styling: 'css' }),
  // Planner-authored checks: shown in the dashboard and used as repair feedback.
  // NOT used for scientific scoring (see docs/EVALUATION.md: held-out checks).
  acceptance_checks: z
    .array(AcceptanceCheckSchema)
    .min(1)
    .max(60)
    .refine((cs) => new Set(cs.map((c) => c.id)).size === cs.length, 'Check ids must be unique'),
});

/** Cross-validation between a requirement spec and a plan. Also feeds "requirement-to-feature consistency". */
export function validatePlanAgainstRequirements(plan, spec) {
  const issues = [];
  const featureIds = new Set(spec.features.map((f) => f.id));
  for (const f of spec.features) {
    if (!plan.acceptance_checks.some((c) => c.feature_id === f.id)) {
      issues.push(`Feature ${f.id} (${f.name}) has no acceptance check`);
    }
  }
  for (const c of plan.acceptance_checks) {
    if (!featureIds.has(c.feature_id)) issues.push(`Check ${c.id} references unknown feature ${c.feature_id}`);
  }
  return issues;
}
