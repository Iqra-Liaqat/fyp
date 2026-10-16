import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';
import { RUN_MODES } from '@fyp/shared';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const EnvSchema = z.object({
  PORT: z.coerce.number().int().default(4000),
  PREVIEW_PORT: z.coerce.number().int().default(4001),
  DASHBOARD_ORIGIN: z.string().default('http://localhost:5173'),
  WORKSPACE_DIR: z.string().default(''),
  LLM_PROVIDER: z.enum(['mock', 'anthropic', 'openai_compatible']).default('anthropic'),
  LLM_API_KEY: z.string().default(''),
  LLM_BASE_URL: z.string().default(''),
  LLM_MODEL_PLANNER: z.string().default(''),
  LLM_MODEL_CODER: z.string().default(''),
  // Empty = let the provider use its default (some newer models reject an explicit temperature)
  LLM_TEMPERATURE: z.string().default('').transform((v) => (v.trim() === '' ? null : Math.min(1, Math.max(0, Number(v))))),
  LLM_TIMEOUT_MS: z.coerce.number().int().default(120000),
  LLM_CODE_TIMEOUT_MS: z.coerce.number().int().default(300000),
  RUN_MODE: z.enum(RUN_MODES).default('live'),
  MAX_REPAIR_ATTEMPTS: z.coerce.number().int().min(0).max(5).default(3),
  BUILD_TIMEOUT_MS: z.coerce.number().int().default(120000),
});

/** Parses env vars. Never throws for a missing API key: the server must boot so the dashboard can explain what is missing. */
export function loadConfig(env = process.env) {
  const parsed = EnvSchema.parse(env);
  return Object.freeze({
    ...parsed,
    rootDir,
    workspaceDir: parsed.WORKSPACE_DIR ? path.resolve(parsed.WORKSPACE_DIR) : path.join(rootDir, 'workspace'),
    llmConfigured: parsed.LLM_PROVIDER === 'mock' || parsed.LLM_API_KEY.length > 0,
  });
}

/** Secret-free view that is safe to send to the browser. */
export function publicConfig(config) {
  return {
    mode_default: config.RUN_MODE,
    llm: {
      provider: config.LLM_PROVIDER,
      configured: config.llmConfigured,
      model_planner: config.LLM_MODEL_PLANNER || null,
      model_coder: config.LLM_MODEL_CODER || null,
      temperature: config.LLM_TEMPERATURE,
    },
    limits: { max_repair_attempts: config.MAX_REPAIR_ATTEMPTS },
    preview_port: config.PREVIEW_PORT,
  };
}

export function loadDotenv() {
  dotenv.config({ path: path.join(rootDir, '.env') });
}
