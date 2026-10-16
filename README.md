# AI Software House: Autonomous MVP Agent (FYP)

Client requirement -> Requirements Agent -> scope gate -> Planning Agent (plan + acceptance criteria) -> Coding Agent (React/JS/CSS) -> static validation -> build -> AI repair (max 3) -> live preview.
Output is an AI-generated functional *prototype*, not production software.

## Run the demo (about 5 minutes)
```bash
node --version               # needs >= 20
npm install
npm run setup                # once: installs the shared React/Vite template used by every generated app
cp .env.example .env         # then edit .env and set LLM_API_KEY (an Anthropic API key from console.anthropic.com)
npm run dev                  # API :4000, previews :4001, dashboard :5173
```
Open http://localhost:5173, click **Student Task Manager**, then **Generate MVP**. A full generation takes roughly 1-3 minutes (live model calls).
Windows PowerShell: use `copy .env.example .env`.

Note: the API key is billed on the Anthropic API, separately from claude.ai chat usage. Models are set in `.env` (`LLM_MODEL_PLANNER`, `LLM_MODEL_CODER`).

## Tests
`npm test` (24+ tests). They use scripted model responses, so they need no API key. The end-to-end test runs the real build, repair and preview.

## Where things are
- `server/src/agents/` requirements, planning, coding, repair agents (+ `prompts/`)
- `server/src/pipeline/orchestrator.js` stage sequencing, repair loop, run states
- `server/src/validation/` scope gate, static checks, build runner
- `server/src/preview/` static preview server on its own port (own browser origin + CSP)
- `server/src/llm/` provider-agnostic client; Anthropic adapter in `providers/anthropic.js`
- `templates/react-vite-base/` locked scaffold; the LLM only writes `src/` files
- `shared/` schemas and constants; `docs/` architecture, security, evaluation design

## Troubleshooting
- "Template dependencies missing": run `npm run setup`.
- "No LLM API key configured": set `LLM_API_KEY` in `.env`, restart `npm run dev`.
- Run FAILED with `LLM_SCHEMA_MISMATCH` or `LLM_TRUNCATED`: click Generate again; if it repeats, tell me the error text and I will tune the prompt.
- Every run's files are in `workspace/runs/<run-id>/` (run.json, events.jsonl, project/).
