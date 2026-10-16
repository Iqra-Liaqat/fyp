import { z } from 'zod';
import { SCHEMA_VERSION, SUPPORTED_PROJECT_TYPES, UNSUPPORTED_PROJECT_TYPE } from '../constants.js';

export const FeatureSchema = z.object({
  id: z.string().regex(/^F\d+$/, 'Feature id must look like F1, F2, ...'),
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(300),
  priority: z.enum(['must', 'should', 'could']).default('must'),
});

export const AssumptionSchema = z.object({
  statement: z.string().min(1).max(300),
  basis: z.enum(['missing_detail', 'ambiguous_detail', 'default_choice']),
});

export const DesignPreferencesSchema = z.object({
  style: z.string().max(60).default('modern'),
  responsive: z.boolean().default(true),
  color_hint: z.string().max(40).optional(),
});

export const RequirementSpecSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  project_name: z.string().min(1).max(100),
  project_type: z.enum([...SUPPORTED_PROJECT_TYPES, UNSUPPORTED_PROJECT_TYPE]),
  summary: z.string().min(1).max(500),
  target_users: z.array(z.string().min(1).max(80)).min(1),
  features: z
    .array(FeatureSchema)
    .min(1)
    .max(12)
    .refine((fs) => new Set(fs.map((f) => f.id)).size === fs.length, 'Feature ids must be unique'),
  design_preferences: DesignPreferencesSchema.default({}),
  data_needs: z.array(z.string().max(200)).default([]),
  assumptions: z.array(AssumptionSchema).default([]),
  open_questions: z.array(z.string().max(300)).default([]),
  // Phrases from the client request that suggest out-of-scope work (consumed by the scope gate)
  out_of_scope_signals: z.array(z.string().max(200)).default([]),
  confidence: z.number().min(0).max(1).optional(),
});

// What an upstream component (e.g. the voice agent) may send: anything partial; the Requirements Agent completes it.
export const RequirementSpecDraftSchema = RequirementSpecSchema.partial();
