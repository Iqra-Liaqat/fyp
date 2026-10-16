import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GENERATED_PROJECT_RULES,
  GeneratedProjectSchema,
  ImplementationPlanSchema,
  RequirementSpecSchema,
  CreateRunRequestSchema,
  getPipelineProfile,
  canTransition,
  ALLOWED_TRANSITIONS,
  RUN_STATUSES,
  isSafeProjectPath,
  validatePlanAgainstRequirements,
} from '../src/index.js';

const spec = RequirementSpecSchema.parse({
  project_name: 'Student Task Manager',
  project_type: 'task_manager',
  summary: 'Add, complete and filter tasks',
  target_users: ['students'],
  features: [
    { id: 'F1', name: 'Add tasks', description: 'Create a task from a text input' },
    { id: 'F2', name: 'Complete tasks', description: 'Mark a task done' },
  ],
});

const check = (id, feature_id) => ({
  id,
  feature_id,
  description: 'x',
  kind: 'presence',
  steps: [{ action: 'expect_visible', target: { by: 'testid', value: 'task-input' } }],
});

const plan = (checks) => ({
  project_name: 'Student Task Manager',
  pages: [{ id: 'home', title: 'Home', route: '#/', purpose: 'Main', components: ['TaskList'] }],
  components: [{ name: 'TaskList', purpose: 'List', file: 'src/components/TaskList.jsx' }],
  functionality: ['Add task'],
  file_plan: [{ path: 'src/App.jsx', purpose: 'Root' }],
  acceptance_checks: checks,
});

test('requirement defaults are applied', () => {
  assert.equal(spec.design_preferences.style, 'modern');
  assert.equal(spec.design_preferences.responsive, true);
  assert.deepEqual(spec.assumptions, []);
});

test('duplicate feature ids are rejected', () => {
  const bad = RequirementSpecSchema.safeParse({ ...spec, features: [spec.features[0], spec.features[0]] });
  assert.equal(bad.success, false);
});

test('all three input kinds validate; invalid kind does not', () => {
  const base = { mode: 'live', condition: 'proposed' };
  assert.ok(CreateRunRequestSchema.safeParse({ ...base, input: { kind: 'transcript', text: 'I need a coffee shop site' } }).success);
  assert.ok(CreateRunRequestSchema.safeParse({ ...base, input: { kind: 'manual', text: 'Task manager for students' } }).success);
  assert.ok(CreateRunRequestSchema.safeParse({ ...base, input: { kind: 'structured', requirements: { project_name: 'X' } } }).success);
  assert.equal(CreateRunRequestSchema.safeParse({ ...base, input: { kind: 'voice', text: 'hello there friend' } }).success, false);
});

test('safe path guard accepts src files and rejects traversal / absolute / reserved / odd extensions', () => {
  for (const ok of ['src/App.jsx', 'src/components/Card.jsx', 'src/styles/app.css']) assert.equal(isSafeProjectPath(ok), true, ok);
  for (const bad of ['../x.js', 'src/../../.env', '/etc/passwd', 'C:/x.js', 'src\\App.jsx', 'src/.env', 'src/a.sh', 'package.json', 'src//a.js', 'src/./a.js', 'src/a'])
    assert.equal(isSafeProjectPath(bad), false, bad);
  const reserved = GeneratedProjectSchema.safeParse({ project_name: 'x', files: [{ path: 'src/main.jsx', content: '' }, { path: 'src/App.jsx', content: '' }] });
  assert.equal(reserved.success, false);
});

test('generated project must contain App.jsx and have unique paths', () => {
  assert.equal(GeneratedProjectSchema.safeParse({ project_name: 'x', files: [{ path: 'src/a.js', content: '' }] }).success, false);
  assert.equal(
    GeneratedProjectSchema.safeParse({ project_name: 'x', files: [{ path: 'src/App.jsx', content: '' }, { path: 'src/app.jsx', content: '' }] }).success,
    false,
  );
  assert.ok(GeneratedProjectSchema.safeParse({ project_name: 'x', files: [{ path: 'src/App.jsx', content: 'export default 1' }] }).success);
});

test('banned patterns are valid regexes and catch the obvious cases', () => {
  const hit = (id, code) => new RegExp(GENERATED_PROJECT_RULES.bannedPatterns.find((p) => p.id === id).source).test(code);
  assert.ok(hit('eval', 'eval("1")'));
  assert.ok(hit('network', "fetch('http://x')"));
  assert.ok(hit('env_access', 'process.env.KEY'));
  assert.ok(hit('remote_asset', '<img src="https://x/y.png"/>'));
  assert.equal(hit('eval', 'const medieval = 1'), false);
});

test('plan/requirement consistency detects uncovered features', () => {
  const p = ImplementationPlanSchema.parse(plan([check('C1', 'F1')]));
  const issues = validatePlanAgainstRequirements(p, spec);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /F2/);
  const full = ImplementationPlanSchema.parse(plan([check('C1', 'F1'), check('C2', 'F2')]));
  assert.deepEqual(validatePlanAgainstRequirements(full, spec), []);
});

test('state machine: every target is a known status; terminals have no exits; happy path exists', () => {
  for (const [from, tos] of Object.entries(ALLOWED_TRANSITIONS)) {
    assert.ok(RUN_STATUSES.includes(from));
    for (const to of tos) assert.ok(RUN_STATUSES.includes(to), `${from} -> ${to}`);
  }
  for (const t of ['PREVIEW_READY', 'FAILED', 'REJECTED_OUT_OF_SCOPE', 'CANCELLED']) assert.equal(ALLOWED_TRANSITIONS[t].length, 0);
  const path = ['CREATED', 'EXTRACTING_REQUIREMENTS', 'CHECKING_SCOPE', 'PLANNING', 'GENERATING_CODE', 'VALIDATING_STATIC', 'BUILDING', 'TESTING', 'PREVIEW_READY'];
  for (let i = 0; i < path.length - 1; i++) assert.ok(canTransition(path[i], path[i + 1]), `${path[i]} -> ${path[i + 1]}`);
  assert.equal(canTransition('PREVIEW_READY', 'BUILDING'), false);
});

test('pipeline profiles differ only in validation/repair', () => {
  const b = getPipelineProfile('baseline');
  const p = getPipelineProfile('proposed');
  const r = getPipelineProfile('blind_retry');
  assert.equal(b.repair, null);
  assert.equal(p.repair.mode, 'targeted_feedback');
  assert.equal(r.repair.mode, 'regenerate_without_feedback');
  assert.deepEqual(b.stages, r.stages);
  assert.ok(p.stages.includes('acceptance_test') && !b.stages.includes('acceptance_test'));
  assert.throws(() => getPipelineProfile('nope'));
});
