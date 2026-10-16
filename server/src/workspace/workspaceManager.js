import fs from 'node:fs/promises';
import path from 'node:path';
import { GENERATED_PROJECT_RULES, isSafeProjectPath } from '@fyp/shared';
import { AppError } from '../errors.js';

const ID_PATTERN = /^run_[a-z0-9]+_[a-f0-9]{6}$/;
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Every generated project lives in workspace/runs/<id>/project. Only src/ is ever written by the LLM. */
export function createWorkspace(config) {
  const templateDir = path.join(config.rootDir, 'templates', 'react-vite-base');
  const runsDir = path.join(config.workspaceDir, 'runs');

  function projectDir(runId) {
    if (!ID_PATTERN.test(runId)) throw new AppError('INVALID_RUN_ID', 'Invalid run id', 400);
    return path.join(runsDir, runId, 'project');
  }

  const viteBin = path.join(templateDir, 'node_modules', 'vite', 'bin', 'vite.js');

  async function templateReady() {
    try {
      await fs.access(viteBin);
      return true;
    } catch {
      return false;
    }
  }

  async function prepare(runId, projectName) {
    if (!(await templateReady())) {
      throw new AppError('TEMPLATE_NOT_INSTALLED', 'Template dependencies missing. Run "npm run setup" once, then retry.', 500);
    }
    const dir = projectDir(runId);
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(path.join(dir, 'src'), { recursive: true });
    for (const f of ['package.json', 'vite.config.js', 'src/main.jsx', 'src/base.css']) {
      await fs.copyFile(path.join(templateDir, f), path.join(dir, f));
    }
    const html = await fs.readFile(path.join(templateDir, 'index.html'), 'utf8');
    await fs.writeFile(path.join(dir, 'index.html'), html.replace('__PROJECT_TITLE__', escapeHtml(projectName).slice(0, 80)));
    // Dependencies are installed once in the template and shared: no per-run npm install, no LLM-chosen packages.
    await fs.symlink(path.join(templateDir, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
    return dir;
  }

  /** Second line of defence (the schema already checked): re-validate every path right before writing. */
  async function writeFiles(runId, files) {
    const dir = projectDir(runId);
    const srcRoot = path.join(dir, 'src') + path.sep;
    for (const f of files) {
      if (!isSafeProjectPath(f.path) || GENERATED_PROJECT_RULES.reservedPaths.includes(f.path)) {
        throw new AppError('UNSAFE_PATH', `Refusing to write ${f.path}`, 400);
      }
      const target = path.resolve(dir, f.path);
      if (!target.startsWith(srcRoot)) throw new AppError('UNSAFE_PATH', `Refusing to write ${f.path}`, 400);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, f.content, 'utf8');
    }
  }

  async function readSources(runId) {
    const root = path.join(projectDir(runId), 'src');
    const out = [];
    async function walk(rel) {
      let entries;
      try {
        entries = await fs.readdir(path.join(root, rel), { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) await walk(r);
        else out.push({ path: `src/${r}`, content: await fs.readFile(path.join(root, r), 'utf8') });
      }
    }
    await walk('');
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  async function hasDist(runId) {
    try {
      await fs.access(path.join(projectDir(runId), 'dist', 'index.html'));
      return true;
    } catch {
      return false;
    }
  }

  return { projectDir, prepare, writeFiles, readSources, hasDist, viteBin, templateReady };
}
