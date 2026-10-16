import path from 'node:path';
import { GENERATED_PROJECT_RULES } from '@fyp/shared';

const TEMPLATE_FILES = new Set(['src/main.jsx', 'src/base.css']);
const EXTENSIONS = ['', '.js', '.jsx', '.css', '.json', '/index.js', '/index.jsx'];
const IMPORT_RE = /(?:import|export)\s+(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]/g;

/** Deterministic checks on generated files, before any build. Returns [{file, line, rule, message}]. */
export function runStaticChecks(files) {
  const violations = [];
  const known = new Set([...files.map((f) => f.path), ...TEMPLATE_FILES]);
  const banned = GENERATED_PROJECT_RULES.bannedPatterns.map((p) => ({ ...p, re: new RegExp(p.source) }));

  for (const file of files) {
    if (!/\.(jsx?|css)$/.test(file.path)) continue;
    file.content.split('\n').forEach((line, i) => {
      for (const rule of banned) {
        if (rule.re.test(line)) violations.push({ file: file.path, line: i + 1, rule: rule.id, message: rule.message });
      }
    });
    if (!/\.jsx?$/.test(file.path)) continue;
    for (const m of file.content.matchAll(IMPORT_RE)) {
      const spec = m[1];
      if (spec.startsWith('.')) {
        const base = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), spec));
        if (!EXTENSIONS.some((ext) => known.has(base + ext))) {
          violations.push({ file: file.path, line: 0, rule: 'missing_file', message: `Import "${spec}" does not match any generated file` });
        }
      } else if (!GENERATED_PROJECT_RULES.allowedImports.includes(spec)) {
        violations.push({ file: file.path, line: 0, rule: 'import_not_allowed', message: `Import "${spec}" is not allowed (only react and react-dom)` });
      }
    }
  }
  return violations;
}

export function formatViolations(violations) {
  return violations.map((v) => `${v.file}${v.line ? `:${v.line}` : ''} [${v.rule}] ${v.message}`).join('\n');
}
