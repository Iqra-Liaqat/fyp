import fs from 'node:fs/promises';
import path from 'node:path';
import { RunRecordSchema } from '@fyp/shared';
import { AppError } from '../errors.js';

const ID_PATTERN = /^run_[a-z0-9]+_[a-f0-9]{6}$/;

/** One folder per run: workspace/runs/<id>/{run.json, events.jsonl, project/, dist/}. JSON on disk keeps data easy to inspect and cite. */
export function createRunStore(workspaceDir) {
  const runsDir = path.join(workspaceDir, 'runs');

  function runDir(id) {
    if (!ID_PATTERN.test(id)) throw new AppError('INVALID_RUN_ID', 'Invalid run id', 400); // blocks path traversal
    return path.join(runsDir, id);
  }

  async function save(record) {
    const parsed = RunRecordSchema.parse(record);
    const dir = runDir(parsed.id);
    await fs.mkdir(dir, { recursive: true });
    const tmp = path.join(
      dir,
      `run.${process.pid}.${Date.now()}.tmp`
    );
    const target = path.join(dir, 'run.json');
    await fs.writeFile(tmp, JSON.stringify(parsed, null, 2));

    try {
      await fs.rename(tmp, target);
    } catch (err) {
      if (err.code !== 'EPERM' && err.code !== 'EEXIST') {
        throw err;
      }

      // Windows fallback when replacing the existing file fails.
      await fs.writeFile(target, JSON.stringify(parsed, null, 2));
      await fs.unlink(tmp).catch(() => {});
    }

    return parsed;
  }

  async function get(id) {
    const dir = runDir(id);
    try {
      return RunRecordSchema.parse(JSON.parse(await fs.readFile(path.join(dir, 'run.json'), 'utf8')));
    } catch (e) {
      if (e.code === 'ENOENT') throw new AppError('RUN_NOT_FOUND', `Run ${id} not found`, 404);
      throw e;
    }
  }

  async function list() {
    let ids = [];
    try {
      ids = (await fs.readdir(runsDir)).filter((n) => ID_PATTERN.test(n));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    const records = [];
    for (const id of ids) {
      try {
        records.push(await get(id));
      } catch {
        /* skip unreadable run folders instead of failing the whole history page */
      }
    }
    return records.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async function appendEvent(id, event) {
    const dir = runDir(id);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(path.join(dir, 'events.jsonl'), JSON.stringify(event) + '\n');
  }

  async function readEvents(id) {
    try {
      const raw = await fs.readFile(path.join(runDir(id), 'events.jsonl'), 'utf8');
      return raw.split('\n').filter(Boolean).map((l) => JSON.parse(l));
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
  }

  return { save, get, list, appendEvent, readEvents, runDir };
}
