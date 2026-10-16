import { z } from 'zod';
import { GENERATED_PROJECT_RULES } from '../constants.js';

const RULES = GENERATED_PROJECT_RULES;
const utf8Length = (s) => new TextEncoder().encode(s).length;

/** Security boundary #1: only relative, normalized paths inside src/ with an allowed extension. */
export function isSafeProjectPath(p) {
  if (typeof p !== 'string' || p.length === 0 || p.length > 120) return false;
  if (p.includes('\0') || p.includes('\\') || p.startsWith('/') || /^[a-zA-Z]:/.test(p)) return false;
  if (!p.startsWith(RULES.allowedPathPrefix)) return false;
  const segments = p.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..' || s.startsWith('.'))) return false;
  const dot = p.lastIndexOf('.');
  if (dot < p.lastIndexOf('/')) return false;
  return RULES.allowedExtensions.includes(p.slice(dot).toLowerCase());
}

export const SafePathSchema = z
  .string()
  .refine(isSafeProjectPath, 'Path must be a relative file inside src/ with an allowed extension')
  .refine((p) => !RULES.reservedPaths.includes(p), 'Path is reserved by the template');

export const GeneratedFileSchema = z.object({
  path: SafePathSchema,
  content: z.string().refine((c) => utf8Length(c) <= RULES.maxFileBytes, `File exceeds ${RULES.maxFileBytes} bytes`),
});

export const GeneratedProjectSchema = z
  .object({
    project_name: z.string().min(1).max(100),
    files: z.array(GeneratedFileSchema).min(1).max(RULES.maxFiles),
  })
  .refine(
    (p) => new Set(p.files.map((f) => f.path.toLowerCase())).size === p.files.length,
    'Duplicate file paths',
  )
  .refine(
    (p) => RULES.requiredPaths.every((req) => p.files.some((f) => f.path === req)),
    `Project must contain ${RULES.requiredPaths.join(', ')}`,
  );
