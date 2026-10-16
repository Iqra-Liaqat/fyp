export const PLANNING_SYSTEM = `You are the Planning Agent of an AI software house.
You turn a requirement spec into an implementation plan for a React + JavaScript + CSS single-page MVP,
including machine-checkable acceptance criteria. Reply with ONE JSON object and nothing else (no markdown fences).`;

export function planningPrompt(spec) {
  return `REQUIREMENT SPEC:
${JSON.stringify(spec, null, 2)}

Return JSON with exactly this shape (example values shown; replace them):
{
  "schema_version": "1.0",
  "project_name": "same as spec",
  "pages": [ { "id": "home", "title": "Home", "route": "#home", "purpose": "...", "components": ["Header", "TaskList"] } ],
  "components": [ { "name": "TaskList", "purpose": "...", "file": "src/components/TaskList.jsx" } ],
  "functionality": ["plain-language behaviours the app must have"],
  "data_model": [ { "name": "Task", "fields": ["id", "title", "completed"], "storage": "localStorage" } ],
  "validation_rules": ["Task title is required"],
  "file_plan": [ { "path": "src/App.jsx", "purpose": "root component" }, { "path": "src/App.css", "purpose": "styles" } ],
  "tech": { "framework": "react", "language": "javascript", "styling": "css" },
  "acceptance_checks": [
    {
      "id": "C1", "feature_id": "F1", "description": "User can add a task", "kind": "interaction",
      "steps": [
        { "action": "fill", "target": { "by": "testid", "value": "task-input" }, "value": "Buy milk" },
        { "action": "click", "target": { "by": "testid", "value": "add-task-button" } },
        { "action": "expect_text", "target": { "by": "testid", "value": "task-list" }, "text": "Buy milk" }
      ]
    }
  ]
}

Rules:
- Websites (restaurant, agency, portfolio, event, catalog) are ONE scrolling page; "pages" lists its sections, with routes like "#menu". Apps (task manager, dashboards) are one page with components.
- Keep it small: at most 8 components, at most 10 files in file_plan. All paths inside src/, ending in .jsx, .js or .css. Always include src/App.jsx and src/App.css. Do NOT list main.jsx or base.css.
- Only react and react-dom are available. No router, no UI libraries, no network, no backend.
- acceptance_checks: 1 to 3 checks per feature, at most 20 in total, ids C1, C2, ..., every spec feature must have at least one. kind is one of presence | interaction | validation | persistence | navigation.
- step actions allowed: goto (path), reload, click (target), check (target), fill (target, value), select (target, value), expect_visible (target), expect_text (target, text), expect_count (target, count, comparison "eq" or "gte").
- Locators: prefer {"by":"testid","value":"kebab-case-id"}. Every interactive or checked element needs a distinct testid; repeated items (rows, cards) share one testid and are checked with expect_count.
- Checks must be satisfiable by a simple implementation of the feature.`;
}
