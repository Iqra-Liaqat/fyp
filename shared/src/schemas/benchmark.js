import { z } from 'zod';
import { SUPPORTED_PROJECT_TYPES } from '../constants.js';
import { AcceptanceCheckSchema } from './plan.js';

// One benchmark item = one client requirement with HAND-WRITTEN ground truth.
export const BenchmarkItemSchema = z.object({
  id: z.string().regex(/^B\d{2}$/),
  category: z.enum(SUPPORTED_PROJECT_TYPES),
  requirement_text: z.string().min(10).max(2000),
  // Ground truth for requirement-extraction accuracy
  expected_features: z.array(z.string().min(1).max(100)).min(1).max(12),
  // Held-out checks: never shown to any agent. Used ONLY to score finished MVPs.
  heldout_checks: z.array(AcceptanceCheckSchema).min(1).max(40),
});
export const BenchmarkSchema = z.array(BenchmarkItemSchema).min(1);
