import { z } from 'zod';
import { EXPERIMENT_CONDITIONS, RUN_MODES } from '../constants.js';
import { RequirementSpecDraftSchema } from './requirement.js';

// Three ways in (A/B/C). After the Requirements stage the pipeline is identical for all three.
export const InputPayloadSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('transcript'), // A: natural-language requirements / call transcript
    text: z.string().min(10).max(12000),
    conversation_id: z.string().max(100).optional(),
  }),
  z.object({
    kind: z.literal('structured'), // B: structured requirement JSON (possibly incomplete)
    requirements: RequirementSpecDraftSchema,
    conversation_id: z.string().max(100).optional(),
  }),
  z.object({
    kind: z.literal('manual'), // C: manual / demo input
    text: z.string().min(10).max(4000),
    scenario_id: z.string().max(60).optional(),
  }),
]);

export const CreateRunRequestSchema = z.object({
  input: InputPayloadSchema,
  mode: z.enum(RUN_MODES).default('live'),
  condition: z.enum(EXPERIMENT_CONDITIONS).default('proposed'),
  benchmark: z
    .object({ item_id: z.string().max(60), trial: z.number().int().min(1).max(20) })
    .optional(),
});
