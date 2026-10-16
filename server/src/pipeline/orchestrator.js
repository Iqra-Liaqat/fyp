import { getPipelineProfile, validatePlanAgainstRequirements } from '@fyp/shared';
import { transition, isTerminal } from './runStateMachine.js';
import { runRequirementsAgent } from '../agents/requirementsAgent.js';
import { runPlanningAgent } from '../agents/planningAgent.js';
import { runCodingAgent } from '../agents/codingAgent.js';
import { runRepairAgent } from '../agents/repairAgent.js';
import { runScopeGate } from '../validation/scopeGate.js';
import { runStaticChecks, formatViolations } from '../validation/staticChecks.js';

const nowIso = () => new Date().toISOString();
const cut = (s, n) => String(s ?? '').slice(0, n);
const firstLine = (s) => cut(String(s).split('\n').find((l) => l.trim()) ?? '', 200);
const manifest = (files) => [...files.entries()].map(([path, content]) => ({ path, bytes: Buffer.byteLength(content) }));
const toArray = (files) => [...files.entries()].map(([path, content]) => ({ path, content }));

/**
 * Orchestrator: sequences stages and records progress. It contains no prompts and no validation rules;
 * those live in agents/ and validation/.
 */
export function createOrchestrator({ store, bus, llm, config, workspace, builder }) {
  const running = new Set();

  async function start(runId) {
    if (running.has(runId)) return;
    running.add(runId);
    try {
      await execute(runId);
    } finally {
      running.delete(runId);
    }
  }

  // ---- stage bookkeeping ----
  async function enterStage(run, stage, status, message) {
    let r = run.status === status ? run : transition(run, status);
    r = { ...r, stages: { ...r.stages, [stage]: { ...r.stages[stage], status: 'running', started_at: nowIso(), finished_at: null, duration_ms: null, message: cut(message, 480), error: null } } };
    r = await store.save(r);
    await bus.publish(r.id, { type: 'status', status: r.status, stage, message: cut(message, 480) });
    return r;
  }

  async function closeStage(run, stage, outcome, { message, patch = {}, error = null }) {
    const st = run.stages[stage];
    const started = st.started_at ? Date.parse(st.started_at) : Date.now();
    let r = {
      ...run,
      ...patch,
      updated_at: nowIso(),
      stages: { ...run.stages, [stage]: { ...st, status: outcome, finished_at: nowIso(), duration_ms: Date.now() - started, message: cut(message, 480), error } },
    };
    r = await store.save(r);
    await bus.publish(r.id, { type: error ? 'error' : 'stage', stage, message: cut(message, 480) });
    return r;
  }
  const finishStage = (run, stage, opts) => closeStage(run, stage, 'succeeded', opts);
  const failStage = (run, stage, code, message) => closeStage(run, stage, 'failed', { message, error: { code, message: cut(message, 1900), stage } });

  async function settleLastAttempt(run, succeeded) {
    const last = run.repair_attempts.at(-1);
    if (!last || last.succeeded !== null) return run;
    const attempts = [...run.repair_attempts.slice(0, -1), { ...last, succeeded }];
    return store.save({ ...run, repair_attempts: attempts });
  }

  // ---- the pipeline ----
  async function execute(runId) {
    let run = await store.get(runId);
    const profile = getPipelineProfile(run.condition);
    const maxRepairs = profile.repair ? config.MAX_REPAIR_ATTEMPTS : 0;
    const log = (message) => bus.publish(runId, { type: 'log', message: cut(message, 900) });
    let currentStage = 'requirements';

    try {
      // 1. Requirements
      run = await enterStage(run, 'requirements', 'EXTRACTING_REQUIREMENTS', 'Analysing the client requirement…');
      const { data: spec } = await runRequirementsAgent(llm, run.input);
      run = await finishStage(run, 'requirements', { message: `${spec.features.length} features extracted · type: ${spec.project_type}`, patch: { requirements: spec } });

      // 2. Scope gate
      currentStage = 'scope_gate';
      run = await enterStage(run, 'scope_gate', 'CHECKING_SCOPE', 'Checking the supported MVP scope…');
      const scope = runScopeGate(spec);
      run = await finishStage(run, 'scope_gate', { message: scope.status === 'supported' ? 'Within supported scope' : `Scope: ${scope.status}`, patch: { scope } });
      if (scope.status === 'rejected') {
        run = transition(run, 'REJECTED_OUT_OF_SCOPE', { outcome: 'rejected' });
        await store.save(run);
        await bus.publish(runId, { type: 'status', status: run.status, message: scope.simplified_suggestion });
        return;
      }
      if (scope.status === 'simplified') await log(scope.simplified_suggestion);

      // 3. Planning
      currentStage = 'planning';
      run = await enterStage(run, 'planning', 'PLANNING', 'Creating the implementation plan…');
      const { data: plan } = await runPlanningAgent(llm, spec);
      const issues = validatePlanAgainstRequirements(plan, spec);
      if (issues.length) await log(`Plan warnings: ${issues.join('; ')}`);
      run = await finishStage(run, 'planning', { message: `${plan.pages.length} sections · ${plan.components.length} components · ${plan.acceptance_checks.length} acceptance checks`, patch: { plan } });

      // 4. Code generation
      currentStage = 'code_generation';
      run = await enterStage(run, 'code_generation', 'GENERATING_CODE', 'Coding agent is writing the application…');
      await workspace.prepare(run.id, spec.project_name);
      const { project } = await runCodingAgent(llm, spec, plan);
      const files = new Map(project.files.map((f) => [f.path, f.content]));
      await workspace.writeFiles(run.id, project.files);
      run = await finishStage(run, 'code_generation', { message: `${files.size} files generated`, patch: { files: manifest(files) } });

      // 5. Validate / build / repair loop
      let attempt = 0;
      for (;;) {
        let failure = null;

        if (profile.stages.includes('static_validation')) {
          currentStage = 'static_validation';
          run = await enterStage(run, 'static_validation', 'VALIDATING_STATIC', attempt ? `Re-validating after repair ${attempt}/${maxRepairs}…` : 'Static validation…');
          const violations = runStaticChecks(toArray(files));
          if (violations.length) {
            failure = { trigger: 'static_violation', text: formatViolations(violations), label: 'Validation error detected' };
            run = await failStage(run, 'static_validation', 'STATIC_VIOLATION', `${violations.length} violation(s): ${firstLine(failure.text)}`);
          } else {
            run = await finishStage(run, 'static_validation', { message: 'No violations (paths, imports, banned patterns)' });
          }
        }

        if (!failure) {
          currentStage = 'build';
          run = await enterStage(run, 'build', 'BUILDING', attempt ? `Rebuilding after repair ${attempt}/${maxRepairs}…` : 'Building the application…');
          const result = await builder.build(run.id);
          if (result.ok) {
            run = await finishStage(run, 'build', { message: `Build succeeded in ${(result.durationMs / 1000).toFixed(1)} s` });
          } else {
            failure = { trigger: 'build_error', text: result.output, label: 'Build error detected' };
            run = await failStage(run, 'build', 'BUILD_ERROR', firstLine(result.output) || 'Build failed');
          }
        }

        run = await settleLastAttempt(run, !failure);
        if (!failure) break;

        if (attempt >= maxRepairs) {
          const code = failure.trigger === 'build_error' ? 'BUILD_FAILED' : 'VALIDATION_FAILED';
          throw Object.assign(new Error(`${failure.label.replace(' detected', '')} could not be repaired after ${attempt} attempt(s): ${firstLine(failure.text)}`), { code });
        }

        attempt += 1;
        currentStage = 'repair';
        run = await enterStage(run, 'repair', 'REPAIRING', `⚠ ${failure.label} — AI repair attempt ${attempt}/${maxRepairs}`);
        await log(`${failure.label}. AI repair attempt ${attempt}/${maxRepairs}.`);
        const t0 = Date.now();
        const { files: changed } = await runRepairAgent(llm, { spec, files: toArray(files), errorText: failure.text, trigger: failure.trigger, attempt, maxAttempts: maxRepairs });
        await workspace.writeFiles(run.id, changed);
        for (const f of changed) files.set(f.path, f.content);
        const record = { attempt, trigger: failure.trigger, error_summary: cut(failure.text, 3900), files_changed: changed.map((f) => f.path), succeeded: null, duration_ms: Date.now() - t0 };
        run = await finishStage(run, 'repair', { message: `Patched ${changed.length} file(s): ${changed.map((f) => f.path).join(', ')}`, patch: { repair_attempts: [...run.repair_attempts, record], files: manifest(files) } });
      }

      // 6. Finish
      for (const stage of ['smoke_test', 'acceptance_test']) {
        if (profile.stages.includes(stage)) {
          run = { ...run, stages: { ...run.stages, [stage]: { ...run.stages[stage], status: 'skipped', message: 'Not implemented in the demo build (planned: Playwright)' } } };
        }
      }
      currentStage = 'preview';
      if (!(await workspace.hasDist(run.id))) throw Object.assign(new Error('Build finished but dist/index.html is missing'), { code: 'NO_DIST' });
      run = {
        ...run,
        stages: { ...run.stages, preview: { ...run.stages.preview, status: 'succeeded', started_at: nowIso(), finished_at: nowIso(), duration_ms: 0, message: 'Preview published' } },
      };
      run = transition(run, 'PREVIEW_READY', {
        outcome: run.repair_attempts.length ? 'success_after_repair' : 'success_first_try',
        preview: { url: `/preview/${run.id}/`, built_at: nowIso() },
      });
      await store.save(run);
      await bus.publish(runId, { type: 'preview', status: run.status, message: 'MVP ready' });
    } catch (e) {
      await recordFailure(runId, currentStage, e);
    }
  }

  async function recordFailure(runId, stage, e) {
    try {
      const latest = await store.get(runId);
      if (isTerminal(latest.status)) return;
      const error = { code: e.code ?? 'PIPELINE_ERROR', message: cut(e.message, 1900), stage };
      const st = latest.stages[stage];
      const failed = transition(latest, 'FAILED', {
        outcome: 'failed',
        error,
        stages: { ...latest.stages, [stage]: { ...st, status: 'failed', finished_at: nowIso(), error, message: cut(e.message, 480) } },
      });
      await store.save(failed);
      await bus.publish(runId, { type: 'error', status: 'FAILED', stage, message: cut(e.message, 900) });
    } catch (inner) {
      console.error('Could not record failure for', runId, inner);
    }
  }

  return { start };
}
