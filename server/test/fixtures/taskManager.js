// Hand-written stand-ins for what the LLM would return. Used ONLY by tests to exercise the real pipeline
// (parsing, validation, file writing, build, repair, preview) without calling a live model.
const tid = (value) => ({ by: 'testid', value });

export const requirementsJson = JSON.stringify({
  schema_version: '1.0',
  project_name: 'Student Task Manager',
  project_type: 'task_manager',
  summary: 'A simple web app for students to add, complete, delete and filter tasks.',
  target_users: ['students'],
  features: [
    { id: 'F1', name: 'Add tasks', description: 'Add a task with a title', priority: 'must' },
    { id: 'F2', name: 'Complete tasks', description: 'Mark a task as completed', priority: 'must' },
    { id: 'F3', name: 'Delete tasks', description: 'Remove a task', priority: 'must' },
    { id: 'F4', name: 'Filter tasks', description: 'Filter by all, active, completed', priority: 'must' },
  ],
  design_preferences: { style: 'modern', responsive: true },
  data_needs: ['task list persisted locally'],
  assumptions: [{ statement: 'Tasks are stored in the browser only', basis: 'default_choice' }],
  open_questions: [],
  out_of_scope_signals: [],
  confidence: 0.9,
});

export const planJson = JSON.stringify({
  schema_version: '1.0',
  project_name: 'Student Task Manager',
  pages: [{ id: 'home', title: 'Tasks', route: '#home', purpose: 'Manage tasks', components: ['TaskForm', 'TaskList'] }],
  components: [
    { name: 'TaskForm', purpose: 'Add a task', file: 'src/components/TaskForm.jsx' },
    { name: 'TaskList', purpose: 'Show, complete, delete tasks', file: 'src/components/TaskList.jsx' },
  ],
  functionality: ['Add task', 'Complete task', 'Delete task', 'Filter tasks', 'Persist in localStorage'],
  data_model: [{ name: 'Task', fields: ['id', 'title', 'completed'], storage: 'localStorage' }],
  validation_rules: ['Task title is required'],
  file_plan: [
    { path: 'src/App.jsx', purpose: 'root' },
    { path: 'src/App.css', purpose: 'styles' },
    { path: 'src/components/TaskForm.jsx', purpose: 'form' },
    { path: 'src/components/TaskList.jsx', purpose: 'list' },
  ],
  tech: { framework: 'react', language: 'javascript', styling: 'css' },
  acceptance_checks: [
    { id: 'C1', feature_id: 'F1', description: 'User can add a task', kind: 'interaction', steps: [
      { action: 'fill', target: tid('task-input'), value: 'Buy milk' },
      { action: 'click', target: tid('add-task-button') },
      { action: 'expect_text', target: tid('task-list'), text: 'Buy milk' } ] },
    { id: 'C2', feature_id: 'F2', description: 'User can complete a task', kind: 'interaction', steps: [
      { action: 'click', target: tid('task-checkbox') }, { action: 'expect_visible', target: tid('task-item') } ] },
    { id: 'C3', feature_id: 'F3', description: 'User can delete a task', kind: 'interaction', steps: [
      { action: 'click', target: tid('delete-task-button') } ] },
    { id: 'C4', feature_id: 'F4', description: 'Filter buttons exist', kind: 'presence', steps: [
      { action: 'expect_visible', target: tid('filter-active') } ] },
  ],
});

const block = (path, content) => `<file path="${path}">\n${content}</file>\n`;

const app = `import { useEffect, useState } from 'react';
import './App.css';
import TaskForm from './components/TaskForm.jsx';
import TaskList from './components/TaskList.jsx';

const SEED = [
  { id: 1, title: 'Finish database assignment', completed: false },
  { id: 2, title: 'Revise for midterm', completed: true },
];

function load() {
  try {
    const raw = localStorage.getItem('tasks');
    return raw ? JSON.parse(raw) : SEED;
  } catch {
    return SEED;
  }
}

export default function App() {
  const [tasks, setTasks] = useState(load);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    try { localStorage.setItem('tasks', JSON.stringify(tasks)); } catch { /* ignore */ }
  }, [tasks]);

  const add = (title) => setTasks((t) => [...t, { id: Date.now(), title, completed: false }]);
  const toggle = (id) => setTasks((t) => t.map((x) => (x.id === id ? { ...x, completed: !x.completed } : x)));
  const remove = (id) => setTasks((t) => t.filter((x) => x.id !== id));
  const visible = tasks.filter((t) => filter === 'all' || (filter === 'active' ? !t.completed : t.completed));

  return (
    <main className="app">
      <h1>Student Task Manager</h1>
      <TaskForm onAdd={add} />
      <div className="filters">
        {['all', 'active', 'completed'].map((f) => (
          <button key={f} data-testid={'filter-' + f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <TaskList tasks={visible} onToggle={toggle} onDelete={remove} />
    </main>
  );
}
`;
const form = `import { useState } from 'react';

export default function TaskForm({ onAdd }) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return setError('Please enter a task title');
    setError('');
    onAdd(title.trim());
    setTitle('');
  };
  return (
    <form onSubmit={submit}>
      <input data-testid="task-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New task" />
      <button data-testid="add-task-button" type="submit">Add</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
`;
const listBroken = `export default function TaskList({ tasks, onToggle, onDelete }) {
  return (
    <ul data-testid="task-list">
      {tasks.map((t) => (
        <li data-testid="task-item" key={t.id}>
          <input data-testid="task-checkbox" type="checkbox" checked={t.completed} onChange={() => onToggle(t.id)} />
          <span>{t.title}</span>
          <button data-testid="delete-task-button" onClick={() => onDelete(t.id)}>Delete</button>
      ))}
    </ul>
  );
}
`;
const listFixed = listBroken.replace('Delete</button>\n      ))}', 'Delete</button>\n        </li>\n      ))}');

export const codeWithBuildError =
  block('src/App.jsx', app) + block('src/App.css', '.app { max-width: 560px; margin: 2rem auto; }\n') + block('src/components/TaskForm.jsx', form) + block('src/components/TaskList.jsx', listBroken);

export const repairFix = block('src/components/TaskList.jsx', listFixed);
