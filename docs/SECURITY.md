# Security boundaries (scoped for an FYP)

Threat model: the LLM may emit buggy or hostile code, by accident or through a prompt-injected client requirement. Docker-level isolation is **future work**; the design below removes most risk by never executing generated code on the server.

| # | Boundary | Mechanism | Where |
|---|---|---|---|
| 1 | File paths | Relative, normalized, inside `src/`, allowed extensions only; no `..`, absolute, backslash, dotfiles; `src/main.jsx` reserved. Applied at schema parse, again at write time | `shared/schemas/project.js`, `workspace/` (Phase 5) |
| 2 | Scaffolding | `package.json`, `vite.config.js`, `index.html`, `main.jsx` come from the locked template; the LLM cannot add dependencies or scripts | `templates/` (Phase 5) |
| 3 | Imports | Allowlist: `react`, `react-dom`, `react-dom/client`, and relative imports | `GENERATED_PROJECT_RULES`, validator in Phase 6 |
| 4 | Dangerous patterns | `eval`, `new Function`, raw HTML injection, env access, network APIs, cookies, dynamic import/require, remote assets are rejected | `GENERATED_PROJECT_RULES.bannedPatterns` |
| 5 | Commands | The LLM never supplies a command. The server runs only fixed `execFile` calls (no shell) with timeouts | `validation/buildRunner.js` (Phase 6) |
| 6 | Secrets | Build processes get a minimal env (`PATH` only); `.env` lives outside the workspace; API keys exist only in the server process. `/api/config` is secret-free | `config/env.js`, Phase 6 |
| 7 | Execution | Generated code runs only in the *browser*, as a static bundle. The server executes the bundler, not the app | Phase 9 |
| 8 | Origin isolation | Preview on a different port (different origin) inside a sandboxed iframe with a CSP, so it cannot read dashboard storage or call `/api` with credentials | `preview/` (Phase 9) |
| 9 | Resource limits | File count/size caps, build and LLM timeouts, max repair attempts | `GENERATED_PROJECT_RULES`, `config/env.js` |
| 10 | Run ids | Strict regex before any path is built from an id | `storage/runStore.js` (done, tested) |

Known residual risks (documented, not solved): a malicious bundle can burn CPU in the viewer's tab; a hostile dependency in the *template* is out of scope; prompt injection can still make the generated *app* say silly things, which the human reviewer sees.
