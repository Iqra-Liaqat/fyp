import { useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';

const TERMINAL = ['PREVIEW_READY', 'FAILED', 'REJECTED_OUT_OF_SCOPE', 'CANCELLED'];
const EVENT_TYPES = ['status', 'stage', 'log', 'repair', 'test_result', 'preview', 'error'];

async function api(path, options) {
  const res = await fetch(`/api${path}`, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Request failed (${res.status})`);
  return body;
}

// ---- derive the pipeline steps shown to the committee from the run record ----
function buildSteps(run, maxRepairs) {
  const st = (k) => run?.stages?.[k] ?? { status: 'pending', message: null };
  const group = (keys, label, doneLabel) => {
    const items = keys.map(st).filter((s) => s.status !== 'skipped');
    const failed = items.find((s) => s.status === 'failed');
    const running = items.find((s) => s.status === 'running');
    const allDone = items.length > 0 && items.every((s) => s.status === 'succeeded');
    const msg = (failed ?? running ?? [...items].reverse().find((s) => s.message))?.message;
    return { label, state: failed ? 'failed' : running ? 'running' : allDone ? 'done' : 'pending', msg: allDone ? (doneLabel ?? msg) : msg };
  };
  const attempts = run?.repair_attempts ?? [];
  const terminal = run && TERMINAL.includes(run.status);
  const repairing = run?.status === 'REPAIRING';
  const repair = {
    label: 'AI self-repair',
    state: repairing ? 'running' : attempts.length ? 'warn' : terminal && run.status === 'PREVIEW_READY' ? 'done' : 'pending',
    msg: repairing
      ? run.stages.repair.message
      : attempts.length
        ? `${attempts.length}/${maxRepairs} attempt(s) · ${attempts.at(-1).succeeded ? 'fixed ✓' : attempts.at(-1).succeeded === false ? 'not fixed' : 'in progress'}`
        : terminal && run.status === 'PREVIEW_READY' ? 'Not needed: code built first time' : 'Runs only if validation or build fails',
  };
  const ready = {
    label: 'MVP ready',
    state: run?.status === 'PREVIEW_READY' ? 'done' : run?.status === 'FAILED' ? 'failed' : run?.status === 'REJECTED_OUT_OF_SCOPE' ? 'failed' : 'pending',
    msg: run?.status === 'PREVIEW_READY' ? 'Live preview available' : run?.status === 'REJECTED_OUT_OF_SCOPE' ? 'Outside supported scope' : run?.status === 'FAILED' ? 'Generation failed' : null,
  };
  return [
    group(['requirements', 'scope_gate'], 'Requirements analysis'),
    group(['planning'], 'AI implementation plan'),
    group(['code_generation'], 'Code generation'),
    group(['static_validation', 'build'], 'Validation & build'),
    repair,
    ready,
  ];
}

const ICON = { done: '✓', failed: '✕', warn: '!', running: '', pending: '' };

function Pipeline({ run, maxRepairs }) {
  const steps = buildSteps(run, maxRepairs);
  return (
    <div className="card">
      <h2>AI pipeline {run && <span className="pill gray">{run.condition}</span>}</h2>
      <ol className="steps">
        {steps.map((s) => (
          <li key={s.label} className={`step ${s.state}`}>
            <span className="dot">{ICON[s.state] || (s.state === 'pending' ? '·' : '')}</span>
            <div>
              <div className="t">{s.label}</div>
              {s.msg && <div className="m">{s.msg}</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Requirements({ run }) {
  const r = run?.requirements;
  if (!r) return null;
  return (
    <div className="card">
      <h2>Generated requirements <span className="pill">{r.project_type}</span></h2>
      <div className="kv"><b>Project</b>{r.project_name}: {r.summary}</div>
      <div className="kv"><b>Target users</b>{r.target_users.map((u) => <span key={u} className="pill gray">{u}</span>)}</div>
      <div className="kv"><b>Features</b>
        <ul className="plain">{r.features.map((f) => <li key={f.id}><strong>{f.id}</strong> {f.name}: {f.description}</li>)}</ul>
      </div>
      {r.assumptions.length > 0 && (
        <div className="kv"><b>Assumptions made by the AI</b>
          <ul className="plain">{r.assumptions.map((a, i) => <li key={i}>{a.statement}</li>)}</ul>
        </div>
      )}
      {run.scope && run.scope.status !== 'supported' && <div className="warn">{run.scope.simplified_suggestion}</div>}
      <details><summary>View JSON</summary><pre>{JSON.stringify(r, null, 2)}</pre></details>
    </div>
  );
}

function Plan({ run }) {
  const p = run?.plan;
  if (!p) return null;
  const byFeature = {};
  p.acceptance_checks.forEach((c) => (byFeature[c.feature_id] ||= []).push(c));
  return (
    <div className="card">
      <h2>AI development plan</h2>
      <div className="kv"><b>Pages / sections</b>{p.pages.map((x) => <span key={x.id} className="pill">{x.title}</span>)}</div>
      <div className="kv"><b>Components</b>{p.components.map((c) => <span key={c.name} className="pill gray" title={c.purpose}>{c.name}</span>)}</div>
      <div className="kv"><b>Functionality</b><ul className="plain">{p.functionality.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
      <div className="kv"><b>Technology</b><span className="pill gray">React</span><span className="pill gray">JavaScript</span><span className="pill gray">CSS</span></div>
      <div className="kv"><b>Acceptance criteria ({p.acceptance_checks.length})</b>
        <ul className="plain">{Object.entries(byFeature).map(([fid, cs]) => <li key={fid}><strong>{fid}</strong>: {cs.map((c) => c.description).join(' · ')}</li>)}</ul>
      </div>
      <details><summary>View JSON</summary><pre>{JSON.stringify(p, null, 2)}</pre></details>
    </div>
  );
}

function Log({ events }) {
  if (!events.length) return null;
  const lines = events.filter((e) => e.message);
  return (
    <div className="card">
      <h2>Agent log</h2>
      <div className="log">{lines.map((e) => <div key={e.seq}>{new Date(e.ts).toLocaleTimeString()} · {e.message}</div>)}</div>
    </div>
  );
}

function CodeTab({ run }) {
  const [files, setFiles] = useState([]);
  const [sel, setSel] = useState(null);
  const attempts = run.repair_attempts.length;
  useEffect(() => {
    if (!run.files.length) return;
    api(`/runs/${run.id}/files`).then((d) => { setFiles(d.files); setSel((s) => s ?? d.files[0]?.path); }).catch(() => {});
  }, [run.id, run.status, attempts, run.files.length]);
  const current = files.find((f) => f.path === sel);
  if (!files.length) return <div className="empty">Generated source files appear here after code generation.</div>;
  return (
    <div className="code">
      <ul>{files.map((f) => <li key={f.path}><button className={f.path === sel ? 'on' : ''} onClick={() => setSel(f.path)}>{f.path.replace('src/', '')}</button></li>)}</ul>
      <pre>{current?.content}</pre>
    </div>
  );
}

function Stage({ run, config, tab, setTab }) {
  const previewUrl = run?.preview ? `http://${window.location.hostname}:${config?.preview_port ?? 4001}${run.preview.url}` : null;
  const status = run?.status;
  const current = run && Object.values(run.stages).find((s) => s.status === 'running');
  let banner = null;
  if (status === 'PREVIEW_READY') banner = <div className="banner ready">✓ MVP READY: this is the application the AI generated{run.repair_attempts.length ? ` (after ${run.repair_attempts.length} automatic repair)` : ''}</div>;
  else if (status === 'FAILED') banner = <div className="banner failed">Generation failed: {run.error?.message}</div>;
  else if (status === 'REJECTED_OUT_OF_SCOPE') banner = <div className="banner failed">{run.scope?.simplified_suggestion}</div>;
  else if (run) banner = <div className="banner work">Working… {current?.message}</div>;

  return (
    <section className="right">
      <div className="tabs">
        <button className={`tab ${tab === 'preview' ? 'on' : ''}`} onClick={() => setTab('preview')}>Generated MVP</button>
        <button className={`tab ${tab === 'code' ? 'on' : ''}`} onClick={() => setTab('code')}>Generated code</button>
        <span className="spacer" />
        {previewUrl && <a className="open-btn" href={previewUrl} target="_blank" rel="noreferrer">Open MVP Preview ↗</a>}
      </div>
      <div className="stage">
        {banner}
        {tab === 'code' && run ? <CodeTab run={run} /> : previewUrl ? (
          <iframe title="Generated MVP" src={previewUrl} sandbox="allow-scripts allow-same-origin allow-forms allow-modals" />
        ) : (
          <div className="empty"><div><div className="big">🛠️</div><p>{run ? 'The generated website will appear here when the build succeeds.' : 'Pick a demo scenario or type a client requirement, then click Generate MVP.'}</p></div></div>
        )}
      </div>
    </section>
  );
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [health, setHealth] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [text, setText] = useState('');
  const [scenarioId, setScenarioId] = useState(null);
  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState('preview');
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  const esRef = useRef(null);

  useEffect(() => {
    api('/config').then(setConfig).catch((e) => setError(`Server unreachable: ${e.message}`));
    api('/health').then(setHealth).catch(() => {});
    api('/demos').then((d) => setScenarios(d.scenarios)).catch(() => {});
  }, []);

  const active = run && !TERMINAL.includes(run.status);

  // Poll the run record: simple and robust. SSE below feeds the live log.
  useEffect(() => {
    if (!run?.id || !active) return undefined;
    const timer = setInterval(() => api(`/runs/${run.id}`).then((d) => setRun(d.run)).catch(() => {}), 900);
    return () => clearInterval(timer);
  }, [run?.id, active]);

  useEffect(() => {
    if (run?.status === 'PREVIEW_READY') setTab('preview');
  }, [run?.status]);

  function openStream(id) {
    esRef.current?.close();
    const es = new EventSource(`/api/runs/${id}/events`);
    const seen = new Set();
    const onEvent = (msg) => {
      if (!msg.data) return;
      try {
        const e = JSON.parse(msg.data);
        if (seen.has(e.seq)) return;
        seen.add(e.seq);
        setEvents((prev) => [...prev, e]);
      } catch { /* ignore malformed event */ }
    };
    EVENT_TYPES.forEach((t) => es.addEventListener(t, onEvent));
    esRef.current = es;
  }
  useEffect(() => { if (run && !active) esRef.current?.close(); }, [run, active]);
  useEffect(() => () => esRef.current?.close(), []);

  async function generate() {
    setError(null);
    setStarting(true);
    setEvents([]);
    setRun(null);
    setTab('preview');
    try {
      const input = { kind: 'manual', text: text.trim(), ...(scenarioId ? { scenario_id: scenarioId } : {}) };
      const { run: created } = await api('/runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input, mode: config?.mode_default ?? 'live', condition: 'proposed' }) });
      setRun(created);
      openStream(created.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  }

  const elapsed = useMemo(() => (run ? Math.max(0, Math.round((Date.parse(run.updated_at) - Date.parse(run.created_at)) / 1000)) : null), [run]);
  const canGenerate = text.trim().length >= 10 && !active && !starting;

  return (
    <>
      <header className="topbar">
        <h1>AI Software House<small>Autonomous requirements-to-MVP agent · FYP demonstration</small></h1>
        <div>
          {elapsed !== null && <span className="badge" style={{ marginRight: 8 }}>{elapsed}s</span>}
          <span className="badge live">Mode: {(config?.mode_default ?? 'live').toUpperCase()}</span>
        </div>
      </header>
      <main className="layout">
        <aside className="left">
          <div className="card">
            <h2>Client requirement</h2>
            <textarea value={text} onChange={(e) => { setText(e.target.value); setScenarioId(null); }} placeholder="Describe what the client wants…" disabled={active} />
            <div className="demos">
              {scenarios.map((s) => <button key={s.id} className="chip-btn" disabled={active} onClick={() => { setText(s.client_text); setScenarioId(s.id); }}>▶ {s.title}</button>)}
            </div>
            <button className="primary" onClick={generate} disabled={!canGenerate}>{active || starting ? 'Generating…' : 'Generate MVP'}</button>
            {error && <div className="warn">{error}</div>}
            {health && !health.llm.configured && <div className="warn">No LLM API key configured. Add LLM_API_KEY to .env and restart the server.</div>}
          </div>
          <Pipeline run={run} maxRepairs={config?.limits?.max_repair_attempts ?? 3} />
          <Requirements run={run} />
          <Plan run={run} />
          <Log events={events} />
        </aside>
        <Stage run={run} config={config} tab={tab} setTab={setTab} />
      </main>
    </>
  );
}
