import { execFile } from 'node:child_process';

const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');

/**
 * Runs the template's vite build. The command is fixed (the LLM never supplies one), there is no shell,
 * and the child only gets PATH: no API keys, no .env.
 */
export function createBuilder({ workspace, config }) {
  async function build(runId) {
    const cwd = workspace.projectDir(runId);
    const started = Date.now();
    const result = await new Promise((resolve) => {
      execFile(
        process.execPath,
        [workspace.viteBin, 'build'],
        { cwd, timeout: config.BUILD_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024, env: { PATH: process.env.PATH ?? '', NODE_ENV: 'production' } },
        (error, stdout, stderr) => {
          const output = stripAnsi(`${stdout}\n${stderr}`).trim();
          if (error?.killed) return resolve({ ok: false, output: `Build timed out after ${config.BUILD_TIMEOUT_MS} ms\n${output}` });
          resolve({ ok: !error, output });
        },
      );
    });
    const ok = result.ok && (await workspace.hasDist(runId));
    return { ok, output: ok ? result.output : result.output || 'Build produced no dist/index.html', durationMs: Date.now() - started };
  }
  return { build };
}
