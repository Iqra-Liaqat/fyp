import { z } from 'zod';
import { RUN_STATUSES } from './run.js';
import { STAGES } from '../constants.js';

// Streamed to the dashboard over SSE; also persisted so old runs can be replayed in the UI.
export const RunEventSchema = z.object({
  run_id: z.string(),
  seq: z.number().int(),
  ts: z.string(),
  type: z.enum(['status', 'stage', 'log', 'repair', 'test_result', 'preview', 'error']),
  status: z.enum(RUN_STATUSES).optional(),
  stage: z.enum(STAGES).optional(),
  message: z.string().max(1000),
  data: z.record(z.string(), z.unknown()).optional(),
});
