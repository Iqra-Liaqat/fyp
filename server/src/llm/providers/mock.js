/** Offline demo provider: deterministic requirements, plan and React MVP. */
export function createMockProvider({ responses = [] } = {}) {
  const queue = [...responses];
  const calls = [];

  const requirements = {
    schema_version: "1.0",
    project_name: "Student Task Manager",
    project_type: "task_manager",
    summary: "A responsive task manager that helps students organize and track daily study tasks.",
    target_users: ["University students"],
    features: [
      { id: "F1", name: "Add tasks", description: "Create a task with a title.", priority: "must" },
      { id: "F2", name: "Complete tasks", description: "Mark tasks as complete or active.", priority: "must" },
      { id: "F3", name: "Delete tasks", description: "Remove tasks from the list.", priority: "must" },
      { id: "F4", name: "Filter tasks", description: "View all, active or completed tasks.", priority: "must" },
      { id: "F5", name: "Save tasks", description: "Keep tasks saved in browser local storage.", priority: "must" }
    ],
    design_preferences: { style: "modern", responsive: true, color_hint: "navy and violet" },
    data_needs: ["Task title", "Completion status", "Task ID"],
    assumptions: [
      { statement: "The app is for one student on one browser.", basis: "default_choice" }
    ],
    open_questions: [],
    out_of_scope_signals: ["Cloud synchronization and real user authentication are not included."],
    confidence: 0.98
  };

  const plan = {
    schema_version: "1.0",
    project_name: "Student Task Manager",
    pages: [
      {
        id: "home",
        title: "My Tasks",
        route: "#home",
        purpose: "Create, organize and track study tasks.",
        components: ["Task Manager"]
      }
    ],
    components: [
      {
        name: "Task Manager",
        purpose: "Task creation, completion, filtering and deletion.",
        file: "src/App.jsx"
      }
    ],
    functionality: [
      "Add tasks with a non-empty title.",
      "Mark tasks complete or active.",
      "Delete individual tasks.",
      "Filter tasks by status.",
      "Persist task changes in localStorage."
    ],
    data_model: [
      {
        name: "Task",
        fields: ["id", "title", "completed"],
        storage: "localStorage"
      }
    ],
    validation_rules: ["Task title is required."],
    file_plan: [
      { path: "src/App.jsx", purpose: "Task manager UI and functionality." },
      { path: "src/App.css", purpose: "Responsive styling." }
    ],
    tech: { framework: "react", language: "javascript", styling: "css" },
    acceptance_checks: [
      {
        id: "C1",
        feature_id: "F1",
        description: "A student can add a task.",
        kind: "interaction",
        steps: [
          { action: "fill", target: { by: "testid", value: "task-input" }, value: "Buy milk" },
          { action: "click", target: { by: "testid", value: "add-task-button" } },
          { action: "expect_text", target: { by: "testid", value: "task-list" }, text: "Buy milk" }
        ]
      },
      {
        id: "C2",
        feature_id: "F2",
        description: "A student can mark a task complete.",
        kind: "interaction",
        steps: [
          { action: "click", target: { by: "testid", value: "task-checkbox" } },
          { action: "expect_visible", target: { by: "testid", value: "task-list" } }
        ]
      },
      {
        id: "C3",
        feature_id: "F3",
        description: "A student can delete a task.",
        kind: "interaction",
        steps: [
          { action: "click", target: { by: "testid", value: "delete-task-button" } },
          { action: "expect_visible", target: { by: "testid", value: "task-list" } }
        ]
      },
      {
        id: "C4",
        feature_id: "F4",
        description: "A student can filter active tasks.",
        kind: "interaction",
        steps: [
          { action: "click", target: { by: "testid", value: "filter-active" } },
          { action: "expect_visible", target: { by: "testid", value: "task-list" } }
        ]
      },
      {
        id: "C5",
        feature_id: "F5",
        description: "The task list remains available after reload.",
        kind: "persistence",
        steps: [
          { action: "reload" },
          { action: "expect_visible", target: { by: "testid", value: "task-list" } }
        ]
      }
    ]
  };

  const code = `<file path="src/App.jsx">
import React, { useEffect, useState } from 'react';
import './App.css';

const starterTasks = [
  { id: 1, title: 'Review lecture notes', completed: false },
  { id: 2, title: 'Finish programming assignment', completed: false },
  { id: 3, title: 'Prepare for physics quiz', completed: true }
];

function App() {
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem('tasks');
      return saved ? JSON.parse(saved) : starterTasks;
    } catch {
      return starterTasks;
    }
  });
  const [title, setTitle] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    } catch {
      // The app remains usable if browser storage is unavailable.
    }
  }, [tasks]);

  function addTask(event) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Please enter a task title.');
      return;
    }
    setTasks((current) => [
      { id: Date.now(), title: trimmed, completed: false },
      ...current
    ]);
    setTitle('');
    setError('');
  }

  function toggleTask(id) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  function deleteTask(id) {
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  const visibleTasks = tasks.filter((task) => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true;
  });

  const remaining = tasks.filter((task) => !task.completed).length;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-icon">✓</span> StudySpace</div>
        <span className="top-label">YOUR PERSONAL WORKSPACE</span>
      </header>

      <section className="hero">
        <p className="eyebrow">YOUR DAY, ORGANIZED</p>
        <h1>Make space for<br /><span>what matters.</span></h1>
        <p className="subtitle">Small steps today. Big progress tomorrow.</p>
      </section>

      <section className="task-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">STUDENT WORKSPACE</p>
            <h2>My tasks <span className="count">{tasks.length}</span></h2>
          </div>
          <span className="status-dot">● Ready to focus</span>
        </div>

        <form className="add-form" onSubmit={addTask}>
          <input
            data-testid="task-input"
            value={title}
            onChange={(event) => { setTitle(event.target.value); setError(''); }}
            placeholder="What do you need to get done?"
            aria-label="Task title"
          />
          <button data-testid="add-task-button" className="add-button" type="submit">
            + Add task
          </button>
        </form>
        {error && <p className="error-message">{error}</p>}

        <div className="filter-row" aria-label="Filter tasks">
          {[
            { id: 'all', label: 'All tasks', testid: 'filter-all' },
            { id: 'active', label: 'In progress', testid: 'filter-active' },
            { id: 'completed', label: 'Completed', testid: 'filter-completed' }
          ].map((item) => (
            <button
              key={item.id}
              data-testid={item.testid}
              className={filter === item.id ? 'filter-button selected' : 'filter-button'}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="task-list" data-testid="task-list">
          {visibleTasks.length === 0 ? (
            <div className="empty-state">
              <span>✦</span>
              <h3>Nothing here just yet</h3>
              <p>Add a task or choose another filter.</p>
            </div>
          ) : visibleTasks.map((task) => (
            <div className="task-row" data-testid="task-item" key={task.id}>
              <input
                type="checkbox"
                data-testid="task-checkbox"
                checked={task.completed}
                onChange={() => toggleTask(task.id)}
                aria-label={'Complete ' + task.title}
              />
              <span className={task.completed ? 'task-title completed' : 'task-title'}>
                {task.title}
              </span>
              <span className={task.completed ? 'task-tag done' : 'task-tag'}>
                {task.completed ? 'DONE' : 'TO DO'}
              </span>
              <button
                data-testid="delete-task-button"
                className="delete-button"
                type="button"
                onClick={() => deleteTask(task.id)}
                aria-label={'Delete ' + task.title}
                title="Delete task"
              >×</button>
            </div>
          ))}
        </div>

        <footer className="task-footer">
          <span><strong>{remaining}</strong> {remaining === 1 ? 'task' : 'tasks'} left to complete</span>
          <button
            data-testid="clear-completed-button"
            type="button"
            className="clear-button"
            onClick={() => setTasks((current) => current.filter((task) => !task.completed))}
          >Clear completed</button>
        </footer>
      </section>

      <p className="bottom-note">A little progress each day adds up to big results. ✨</p>
    </main>
  );
}

export default App;
</file>
<file path="src/App.css">
:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #18233e;
  background: #f5f7fc;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; }
button, input { font: inherit; }
button { cursor: pointer; }
.app-shell { max-width: 900px; margin: 0 auto; padding: 0 28px 44px; }
.topbar { height: 78px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e7eaf3; }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 19px; letter-spacing: -0.5px; }
.brand-icon { display: grid; place-items: center; width: 34px; height: 34px; color: white; background: #6658df; border-radius: 11px; }
.top-label, .eyebrow { font-size: 10px; font-weight: 800; letter-spacing: 1.8px; color: #818ba5; }
.hero { padding: 48px 0 32px; }
.hero .eyebrow { color: #6658df; }
h1 { margin: 12px 0; font-size: clamp(36px, 6vw, 56px); line-height: 1.08; letter-spacing: -2.5px; }
h1 span { color: #6658df; }
.subtitle { color: #7d879e; font-size: 15px; }
.task-card { background: white; border: 1px solid #e9ecf5; border-radius: 22px; padding: 28px; box-shadow: 0 18px 55px rgba(39, 50, 90, 0.07); }
.card-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.card-heading .eyebrow { margin: 0 0 8px; }
h2 { margin: 0; font-size: 25px; letter-spacing: -0.8px; }
.count { display: inline-grid; place-items: center; min-width: 26px; height: 26px; padding: 0 6px; border-radius: 8px; background: #efedff; color: #6658df; font-size: 13px; vertical-align: 3px; }
.status-dot { color: #31866c; font-size: 12px; font-weight: 700; }
.add-form { display: flex; gap: 10px; margin: 24px 0 8px; }
.add-form input { flex: 1; min-width: 0; padding: 14px 15px; border: 1px solid #e1e5ef; border-radius: 11px; outline: none; background: #fbfcff; }
.add-form input:focus { border-color: #8175ef; box-shadow: 0 0 0 3px #efedff; }
.add-button { border: 0; border-radius: 11px; padding: 0 19px; background: #6658df; color: white; font-weight: 700; transition: background .2s, transform .2s; }
.add-button:hover { background: #5144c7; transform: translateY(-1px); }
.error-message { margin: 8px 0; color: #c03955; font-size: 13px; }
.filter-row { display: flex; gap: 8px; padding: 20px 0 16px; border-bottom: 1px solid #edf0f6; }
.filter-button { border: 1px solid transparent; border-radius: 9px; padding: 9px 12px; background: transparent; color: #7d879e; font-size: 12px; font-weight: 700; }
.filter-button:hover { background: #f5f4ff; }
.filter-button.selected { background: #efedff; color: #5d50d3; border-color: #e2deff; }
.task-list { min-height: 100px; }
.task-row { display: flex; align-items: center; gap: 13px; padding: 17px 5px; border-bottom: 1px solid #f0f2f7; }
.task-row input[type="checkbox"] { width: 18px; height: 18px; accent-color: #6658df; cursor: pointer; }
.task-title { flex: 1; overflow-wrap: anywhere; font-size: 14px; font-weight: 600; }
.task-title.completed { color: #a3aabd; text-decoration: line-through; }
.task-tag { padding: 5px 8px; border-radius: 6px; background: #fff5e7; color: #b87922; font-size: 9px; font-weight: 800; letter-spacing: .7px; }
.task-tag.done { background: #e7f7f0; color: #278566; }
.delete-button { width: 30px; height: 30px; border: 0; border-radius: 8px; background: transparent; color: #a0a8ba; font-size: 23px; }
.delete-button:hover { background: #fff0f1; color: #c03955; }
.task-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-top: 19px; color: #818ba0; font-size: 12px; }
.task-footer strong { color: #6658df; }
.clear-button { border: 0; background: transparent; color: #6658df; font-size: 12px; font-weight: 700; }
.clear-button:hover { text-decoration: underline; }
.empty-state { text-align: center; padding: 30px 10px; color: #818ba0; }
.empty-state span { font-size: 28px; color: #6658df; }
.empty-state h3 { margin: 8px 0; color: #26314c; }
.empty-state p { font-size: 13px; }
.bottom-note { text-align: center; margin-top: 28px; color: #929bb0; font-size: 12px; }
button:focus-visible { outline: 3px solid #b9b2ff; outline-offset: 2px; }
@media (max-width: 600px) {
  .app-shell { padding: 0 15px 30px; }
  .topbar { height: 65px; }
  .top-label { font-size: 8px; letter-spacing: 1px; }
  .hero { padding: 34px 0 24px; }
  .task-card { padding: 19px 15px; border-radius: 17px; }
  .card-heading { align-items: flex-start; flex-direction: column; }
  .add-form { flex-direction: column; }
  .add-form input, .add-button { min-height: 46px; }
  .filter-row { gap: 2px; }
  .filter-button { padding: 9px 7px; font-size: 11px; }
  .task-row { gap: 8px; }
  .task-tag { display: none; }
}
</file>`;
 function detectProject(request) {
  // First, use the selected project name—not the entire prompt.
  const name = String(request.projectName ?? "").toLowerCase();

  if (name.includes("student") || name.includes("task manager")) {
    return "task_manager";
  }

  if (
    name.includes("restaurant") ||
    name.includes("food menu") ||
    name.includes("reservation")
  ) {
    return "restaurant";
  }

  if (
    name.includes("marketing") ||
    name.includes("agency") ||
    name.includes("seo")
  ) {
    return "marketing";
  }

  // Only inspect the full request if the name isn't descriptive.
  const content = JSON.stringify(request).toLowerCase();

  if (content.includes("student task manager")) return "task_manager";
  if (content.includes("restaurant website")) return "restaurant";
  if (content.includes("digital marketing agency")) return "marketing";

  return "task_manager";
}

  const restaurantCode = `<file path="src/App.jsx">
import React, { useState } from 'react';
import './App.css';

const menu = [
  { name: 'Classic Burger', category: 'Mains', price: '$12', emoji: '🍔' },
  { name: 'Margherita Pizza', category: 'Mains', price: '$15', emoji: '🍕' },
  { name: 'Garden Salad', category: 'Starters', price: '$8', emoji: '🥗' },
  { name: 'Chocolate Cake', category: 'Desserts', price: '$7', emoji: '🍰' }
];

export default function App() {
  const [category, setCategory] = useState('All');
  const [name, setName] = useState('');
  const [guests, setGuests] = useState('2');
  const [message, setMessage] = useState('');

  const items = menu.filter(item =>
    category === 'All' || item.category === category
  );

  function reserve(event) {
    event.preventDefault();
    if (!name.trim()) {
      setMessage('Please enter your name.');
      return;
    }
    setMessage('Thanks, ' + name + '! Your demo reservation request is ready.');
  }

  return (
    <main>
      <nav className="nav">
        <a className="brand" href="#home">Saffron & Stone</a>
        <div className="navlinks">
          <a href="#menu">Our Menu</a>
          <a href="#about">Our Story</a>
          <a href="#reserve">Reservations</a>
        </div>
      </nav>

      <section className="hero" id="home">
        <p className="eyebrow">FRESH INGREDIENTS · MEMORABLE MOMENTS</p>
        <h1>Good food.<br /><span>Great company.</span></h1>
        <p>Thoughtfully prepared dishes, seasonal ingredients, and a table waiting for you.</p>
        <a className="button" href="#menu">Explore Our Menu</a>
      </section>

      <section className="section" id="menu">
        <p className="eyebrow">MADE WITH LOVE</p>
        <h2>Something for everyone.</h2>
        <div className="filters">
          {['All', 'Starters', 'Mains', 'Desserts'].map(c =>
            <button key={c} className={category === c ? 'active' : ''}
              onClick={() => setCategory(c)}>{c}</button>
          )}
        </div>
        <div className="menu-grid">
          {items.map(item => (
            <article className="menu-card" key={item.name}>
              <div className="food">{item.emoji}</div>
              <p className="eyebrow">{item.category}</p>
              <h3>{item.name}</h3>
              <p>Freshly prepared with our signature ingredients.</p>
              <strong>{item.price}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="about" id="about">
        <p className="eyebrow">OUR PHILOSOPHY</p>
        <h2>A little warmth.<br />A lot of flavour.</h2>
        <p>We believe great dining is about more than what is on your plate. It is about the people, the atmosphere, and the memories you take home.</p>
      </section>

      <section className="section reservation" id="reserve">
        <p className="eyebrow">JOIN US AT THE TABLE</p>
        <h2>Reserve your table.</h2>
        <form onSubmit={reserve}>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Your name" aria-label="Your name" />
          <select value={guests} onChange={e => setGuests(e.target.value)}
            aria-label="Number of guests">
            <option value="1">1 guest</option><option value="2">2 guests</option>
            <option value="3">3 guests</option><option value="4">4 guests</option>
            <option value="5">5 guests</option><option value="6">6 guests</option>
          </select>
          <button className="button" type="submit">Request a Reservation</button>
        </form>
        {message && <p role="status">{message}</p>}
        <p>Demo only: reservations are not sent to a real restaurant.</p>
      </section>

      <footer className="footer">SAFFRON & STONE · GOOD FOOD, GOOD COMPANY</footer>
    </main>
  );
}
</file>
<file path="src/App.css">
:root { font-family: Georgia, 'Times New Roman', serif; color: #29281f; background: #faf7f0; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; min-width: 320px; }
a { color: inherit; text-decoration: none; }
button, input, select { font: inherit; }
.nav { display: flex; justify-content: space-between; align-items: center; padding: 22px 7%; border-bottom: 1px solid #e8e0d2; gap: 20px; }
.brand { font-size: 24px; font-weight: bold; color: #8c402b; }
.navlinks { display: flex; gap: 24px; font-family: Arial, sans-serif; font-size: 13px; }
.hero { padding: 100px 8%; background: linear-gradient(115deg, #f1e4d1, #faf7f0 70%); }
.eyebrow { font: 700 11px Arial, sans-serif; letter-spacing: 2px; color: #9b6243; }
h1 { font-size: clamp(48px, 8vw, 86px); line-height: 1.02; margin: 22px 0; }
h1 span { color: #a24e32; font-style: italic; }
.hero > p:not(.eyebrow), .about > p:not(.eyebrow) { max-width: 510px; line-height: 1.8; color: #6f6a60; }
.button { display: inline-block; border: 0; background: #8c402b; color: white; padding: 14px 22px; border-radius: 4px; cursor: pointer; margin-top: 15px; }
.section { padding: 75px 8%; }
h2 { font-size: clamp(32px, 5vw, 48px); margin: 12px 0 28px; }
.filters { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 25px; }
.filters button { padding: 10px 17px; border: 1px solid #d8cabb; background: transparent; border-radius: 24px; cursor: pointer; }
.filters button.active { background: #8c402b; color: white; }
.menu-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 20px; }
.menu-card { background: white; padding: 25px; border: 1px solid #eee5d8; border-radius: 8px; }
.food { font-size: 48px; background: #f6eee2; border-radius: 8px; padding: 22px; text-align: center; }
.menu-card h3 { font-size: 23px; margin-bottom: 8px; }
.menu-card p:not(.eyebrow) { font: 14px/1.7 Arial, sans-serif; color: #777166; }
.menu-card strong { color: #8c402b; }
.about { padding: 80px 8%; background: #292f25; color: white; }
.about .eyebrow { color: #d6b38d; }
.about > p:not(.eyebrow) { color: #e0ddd4; }
.reservation { text-align: center; }
.reservation form { max-width: 620px; margin: 25px auto; display: flex; gap: 10px; flex-wrap: wrap; }
.reservation input, .reservation select { flex: 1; min-width: 150px; padding: 14px; border: 1px solid #ddd2c2; border-radius: 4px; background: white; }
.reservation .button { margin-top: 0; }
.footer { padding: 25px; text-align: center; background: #292f25; color: white; font: 11px Arial, sans-serif; letter-spacing: 2px; }
@media(max-width: 600px) { .nav { align-items: flex-start; flex-direction: column; } .navlinks { gap: 14px; flex-wrap: wrap; } .hero { padding: 65px 7%; } .section { padding: 55px 7%; } .reservation form { flex-direction: column; } }
</file>`;

  const marketingCode = `<file path="src/App.jsx">
import React, { useState } from 'react';
import './App.css';

const services = [
  { icon: '↗', title: 'Search Engine Optimization', text: 'Build sustainable visibility and attract the right people through search.' },
  { icon: '◎', title: 'Content Marketing', text: 'Turn useful content into stronger relationships and qualified leads.' },
  { icon: '⌘', title: 'Paid Campaigns', text: 'Make your advertising budget work harder with focused campaigns.' },
  { icon: '▥', title: 'Analytics & Strategy', text: 'Understand performance and make decisions with clearer data.' }
];

export default function App() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  function submit(event) {
    event.preventDefault();
    setMessage(email.includes('@')
      ? 'Thanks! This demo form is ready for a real contact-service integration.'
      : 'Please enter a valid email address.');
  }

  return (
    <main>
      <nav className="nav">
        <a className="brand" href="#home"><span>▲</span> GROWTHLAB</a>
        <div className="links"><a href="#services">Services</a><a href="#work">Our Approach</a><a href="#contact">Contact</a></div>
        <a className="nav-cta" href="#contact">Let's Talk ↗</a>
      </nav>

      <section className="hero" id="home">
        <div className="hero-copy">
          <p className="eyebrow">DIGITAL GROWTH, BUILT AROUND YOU</p>
          <h1>Turn your next<br />click into <span>growth.</span></h1>
          <p>We combine smart strategy, creative content, and measurable marketing to help ambitious businesses move forward.</p>
          <a className="cta" href="#contact">Plan Your Growth ↗</a>
          <div className="proof"><div><strong>Strategy</strong><small>Built for your goals</small></div><div><strong>Performance</strong><small>Focused on results</small></div><div><strong>Partnership</strong><small>Made to grow with you</small></div></div>
        </div>
        <div className="hero-art"><div className="orb">G</div><div className="metric"><small>CAMPAIGN MOMENTUM</small><strong>↑ Growth mindset</strong><div className="bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div className="float-card">✦ Ideas into impact</div></div>
      </section>

      <section className="services" id="services">
        <p className="eyebrow">WHAT WE DO</p><h2>Marketing with a purpose.</h2>
        <p className="section-intro">The right mix of creative thinking and practical execution.</p>
        <div className="service-grid">{services.map(s => <article className="service" key={s.title}><span>{s.icon}</span><h3>{s.title}</h3><p>{s.text}</p><a href="#contact">Explore service ↗</a></article>)}</div>
      </section>

      <section className="approach" id="work">
        <p className="eyebrow">OUR APPROACH</p><h2>Clear thinking.<br />Consistent progress.</h2>
        <div className="steps"><article><strong>01</strong><h3>Discover</h3><p>Understand your audience, goals, and biggest opportunities.</p></article><article><strong>02</strong><h3>Build</h3><p>Create a focused plan that connects channels and content.</p></article><article><strong>03</strong><h3>Improve</h3><p>Measure what matters and refine the work over time.</p></article></div>
      </section>

      <section className="contact" id="contact">
        <p className="eyebrow">READY WHEN YOU ARE</p><h2>Let's grow something<br />meaningful.</h2>
        <p>Tell us where you want your business to go.</p>
        <form onSubmit={submit}><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your work email" aria-label="Your work email" required /><button className="cta">Start a conversation ↗</button></form>
        {message && <p role="status">{message}</p>}
        <small>Demo contact form only. No message is sent.</small>
      </section>
      <footer className="footer">GROWTHLAB © 2026 · DIGITAL STRATEGY & PERFORMANCE</footer>
    </main>
  );
}
</file>
<file path="src/App.css">
:root { font-family: Inter, Arial, sans-serif; color: #182139; background: #f8f9fc; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; min-width: 320px; }
a { text-decoration: none; color: inherit; }
button, input { font: inherit; }
.nav { min-height: 78px; display: flex; align-items: center; justify-content: space-between; padding: 16px 7%; gap: 22px; background: white; border-bottom: 1px solid #edf0f5; }
.brand { font-size: 20px; font-weight: 900; letter-spacing: 1px; }
.brand span { color: #6955e8; margin-right: 8px; }
.links { display: flex; gap: 26px; color: #667087; font-size: 13px; }
.nav-cta, .cta { display: inline-block; background: #6654e8; color: white; padding: 13px 19px; border-radius: 8px; border: 0; cursor: pointer; font-weight: 700; }
.hero { padding: 78px 8%; display: grid; grid-template-columns: 1.1fr .9fr; align-items: center; gap: 40px; background: radial-gradient(circle at 80% 35%, #e9e5ff, transparent 38%), #f8f9fc; }
.eyebrow { color: #6b57e8; font-size: 11px; font-weight: 800; letter-spacing: 2px; }
h1 { font-size: clamp(43px, 6vw, 70px); line-height: 1.06; letter-spacing: -3px; margin: 20px 0; }
h1 span { color: #6955e8; }
.hero-copy > p:not(.eyebrow), .section-intro { max-width: 520px; color: #69738a; line-height: 1.8; }
.proof { display: flex; gap: 25px; margin-top: 42px; flex-wrap: wrap; }
.proof div { display: grid; gap: 5px; }
.proof strong { font-size: 13px; }
.proof small { color: #8991a3; font-size: 11px; }
.hero-art { min-height: 320px; position: relative; display: grid; place-items: center; }
.orb { width: 210px; height: 210px; border-radius: 50%; display: grid; place-items: center; color: white; font-size: 85px; font-weight: 900; background: linear-gradient(135deg, #8f7bff, #5140c9); box-shadow: 0 25px 65px #bcb2ff; }
.metric, .float-card { position: absolute; background: white; border: 1px solid #ebe9f9; box-shadow: 0 14px 35px #27205d12; border-radius: 13px; padding: 17px; }
.metric { left: 0; bottom: 12px; }
.metric small { display: block; color: #8b91a3; font-size: 9px; letter-spacing: 1px; }
.metric strong { display: block; margin-top: 9px; }
.bars { display: flex; gap: 6px; align-items: end; height: 45px; margin-top: 12px; }
.bars i { display: block; width: 13px; border-radius: 3px; background: #8e7bff; }
.bars i:nth-child(1) { height: 25%; }.bars i:nth-child(2) { height: 45%; }.bars i:nth-child(3) { height: 35%; }.bars i:nth-child(4) { height: 60%; }.bars i:nth-child(5) { height: 52%; }.bars i:nth-child(6) { height: 80%; }.bars i:nth-child(7) { height: 100%; }
.float-card { right: 0; top: 20px; font-weight: 700; font-size: 12px; }
.services, .approach { padding: 75px 8%; }
h2 { font-size: clamp(30px, 4vw, 46px); letter-spacing: -1.5px; margin: 12px 0; }
.service-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 17px; margin-top: 35px; }
.service { padding: 26px; background: white; border: 1px solid #e9ebf3; border-radius: 14px; }
.service > span { color: #6955e8; font-size: 28px; }
.service h3 { font-size: 17px; }
.service p, .steps p { color: #778096; font-size: 13px; line-height: 1.8; }
.service a { color: #6955e8; font-size: 12px; font-weight: 700; }
.approach { background: #191b35; color: white; }
.approach .eyebrow { color: #b5aaff; }
.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px; margin-top: 30px; }
.steps article { border-top: 1px solid #464765; padding-top: 20px; }
.steps strong { color: #a99cff; }
.steps p { color: #c0c1d2; }
.contact { padding: 80px 8%; text-align: center; background: #eeecff; }
.contact form { display: flex; gap: 10px; justify-content: center; margin: 25px auto 12px; max-width: 580px; }
.contact input { flex: 1; min-width: 0; padding: 14px; border: 1px solid #d9d5f5; border-radius: 8px; }
.contact small { color: #81869a; }
.footer { padding: 25px; text-align: center; background: #191b35; color: white; font-size: 10px; letter-spacing: 1.5px; }
@media(max-width: 700px) { .nav { flex-wrap: wrap; } .links { order: 3; width: 100%; justify-content: center; } .hero { grid-template-columns: 1fr; padding: 55px 7%; } .hero-art { min-height: 290px; } .steps { grid-template-columns: 1fr; } .contact form { flex-direction: column; } .services, .approach { padding: 55px 7%; } }
</file>`;

  return {
    name: 'mock',
    calls,
    async complete(request) {
      calls.push(request);
      if (queue.length) {
        const next = queue.shift();
        const value = typeof next === 'function' ? await next(request) : next;
        const base = { text: '', toolCalls: [], usage: { input_tokens: 0, output_tokens: 0 } };
        return typeof value === 'string' ? { ...base, text: value } : { ...base, ...value };
      }

           const project = detectProject(request);
      let text = '';

      if (project === 'restaurant') {
        if (request.stage === 'code_generation' || request.stage === 'repair') {
          text = restaurantCode;
        } else if (request.stage === 'requirements') {
          text = JSON.stringify({
            ...requirements,
            project_name: 'Saffron & Stone Restaurant',
            project_type: 'restaurant_website',
            summary: 'A responsive restaurant website with a categorized menu and reservation request form.',
            target_users: ['Restaurant customers'],
            features: [
              { id: 'F1', name: 'Browse menu', description: 'View food items and prices.', priority: 'must' },
              { id: 'F2', name: 'Filter menu', description: 'Filter food by category.', priority: 'must' },
              { id: 'F3', name: 'Reservation request', description: 'Enter a name and guest count.', priority: 'must' }
            ],
            design_preferences: { style: 'warm elegant restaurant', responsive: true, color_hint: 'cream and terracotta' },
            data_needs: ['Menu items', 'Menu categories', 'Reservation form fields']
          });
        } else {
          text = JSON.stringify({
            ...plan,
            project_name: 'Saffron & Stone Restaurant',
            pages: [{ id: 'home', title: 'Restaurant Home', route: '#home', purpose: 'Present the restaurant, menu, and reservation form.', components: ['Navigation', 'Hero', 'Menu', 'Reservation Form'] }],
            components: [{ name: 'Restaurant Website', purpose: 'Restaurant landing page, category filters, and reservation demo form.', file: 'src/App.jsx' }],
            functionality: ['Browse menu items.', 'Filter by menu category.', 'Submit a demo reservation request.'],
            file_plan: [{ path: 'src/App.jsx', purpose: 'Restaurant website and interactions.' }, { path: 'src/App.css', purpose: 'Restaurant responsive styling.' }]
          });
        }
      } else if (project === 'marketing') {
        if (request.stage === 'code_generation' || request.stage === 'repair') {
          text = marketingCode;
        } else if (request.stage === 'requirements') {
          text = JSON.stringify({
            ...requirements,
            project_name: 'GrowthLab Digital Marketing',
            project_type: 'business_website',
            summary: 'A responsive digital marketing agency website presenting SEO, content, paid campaign, and analytics services.',
            target_users: ['Business owners', 'Marketing clients'],
            features: [
              { id: 'F1', name: 'Present services', description: 'Show marketing services and benefits.', priority: 'must' },
              { id: 'F2', name: 'Explain approach', description: 'Show the agency work process.', priority: 'must' },
              { id: 'F3', name: 'Contact form', description: 'Validate an email and show demo confirmation.', priority: 'must' }
            ],
            design_preferences: { style: 'modern professional agency', responsive: true, color_hint: 'violet, navy and white' },
            data_needs: ['Service details', 'Agency approach', 'Contact email']
          });
        } else {
          text = JSON.stringify({
            ...plan,
            project_name: 'GrowthLab Digital Marketing',
            pages: [{ id: 'home', title: 'Agency Home', route: '#home', purpose: 'Present services, approach, and contact form.', components: ['Navigation', 'Hero', 'Services', 'Approach', 'Contact'] }],
            components: [{ name: 'Marketing Agency Website', purpose: 'Agency landing page, service cards, and contact form.', file: 'src/App.jsx' }],
            functionality: ['Navigate to services and contact sections.', 'Display marketing services.', 'Validate contact email and show demo confirmation.'],
            file_plan: [{ path: 'src/App.jsx', purpose: 'Marketing agency website and interactions.' }, { path: 'src/App.css', purpose: 'Marketing agency responsive styling.' }]
          });
        }
      } else {
        if (request.stage === 'requirements') text = JSON.stringify(requirements);
        else if (request.stage === 'planning') text = JSON.stringify(plan);
        else if (request.stage === 'code_generation' || request.stage === 'repair') text = code;
        else text = JSON.stringify(requirements);
      }
      return {
        text,
        toolCalls: [],
        usage: { input_tokens: 0, output_tokens: 0 }
      };
    }
  };
}
