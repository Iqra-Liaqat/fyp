import { z } from 'zod';
import { OUT_OF_SCOPE_CATEGORIES, SUPPORTED_PROJECT_TYPES } from '../constants.js';

export const ScopeDecisionSchema = z.object({
  status: z.enum(['supported', 'simplified', 'rejected']),
  project_type: z.enum(SUPPORTED_PROJECT_TYPES).nullable(),
  matched_out_of_scope: z.array(z.enum(OUT_OF_SCOPE_CATEGORIES)).default([]),
  reasons: z.array(z.string().max(300)).default([]),
  // Shown to the user: "This request is outside the supported MVP scope. I can generate a simplified web-based prototype."
  simplified_suggestion: z.string().max(600).nullable().default(null),
  // When status = simplified, the reduced feature list actually passed to the planner
  retained_feature_ids: z.array(z.string()).default([]),
});
