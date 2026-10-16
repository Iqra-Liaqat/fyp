const GUIDES = {
  task_manager: `- One page. Header with app name and tagline. Add-task form (title input, Add button) with inline error when the title is empty.
- Task list: checkbox to complete, title (struck through when done), delete button per task. Filter buttons All / Active / Completed with counts, the active filter visibly highlighted.
- Empty-state message per filter. Footer: "N tasks left" and "Clear completed".
- Persist tasks in localStorage (key "tasks"); seed 3 realistic student tasks on first load.`,
  restaurant_website: `- Sticky top nav with anchor links. Hero with restaurant name, tagline and a "Reserve a table" button linking to the reservation section.
- Menu grouped by category (Starters, Mains, Desserts, Drinks) with item name, short description and price. 3-5 items per category.
- Opening hours as a table (all 7 days). Contact section: address, phone, email.
- Reservation form: name, email, phone, date, time, guests (select), special requests. Validate required fields with inline errors; on success hide the form errors and show a clear confirmation message. Save reservations to localStorage.
- Footer. Invent a believable restaurant name and cuisine.`,
  business_website: `- Sticky top nav with anchor links. Hero with headline, subheadline and primary CTA button.
- Services: 4-6 cards with emoji icon, title, description. Pricing: 3 tiers (middle one highlighted) with price, feature list, button.
- Portfolio: grid of 6 case-study cards using CSS gradient tiles and emoji instead of images, each with client, result metric and short description.
- Call-to-action banner. Contact form (name, email, message, optional service select) with validation and a visible success confirmation. Footer.
- Invent a believable agency name and positioning.`,
};
const DEFAULT_GUIDE = '- Use clear sections appropriate for this project type, realistic content, and working interactions for every feature.';

export const CODING_SYSTEM = `You are the Coding Agent of an AI software house. You write complete, working React MVPs.
You output ONLY <file path="..."> blocks, no explanations and no markdown fences.`;

export function collectTestIds(plan) {
  const ids = new Set();
  for (const check of plan.acceptance_checks) {
    for (const step of check.steps) {
      if (step.target?.by === 'testid') ids.add(step.target.value);
    }
  }
  return [...ids];
}

export const RULES = `HARD RULES (a violation fails validation):
- React 18 function components with hooks, JavaScript (JSX), plain CSS. State in useState/useReducer. localStorage allowed only inside try/catch.
- The ONLY imports allowed: "react", "react-dom", and relative imports of files you create. No router, icon, UI, animation or utility libraries.
- No network calls (fetch, XMLHttpRequest, WebSocket), no eval, no dangerouslySetInnerHTML, no process.env / import.meta.env, no external URLs for images, fonts or scripts (use CSS gradients, emoji, inline SVG).
- Allowed file paths: inside src/ only, extensions .jsx .js .css .json. Do NOT create or edit main.jsx, base.css, index.html, package.json or any config file. The template already renders <App /> from src/App.jsx and loads base.css.
- src/App.jsx must have a default export. Put styles in src/App.css (and optional per-component css) and import them from JSX, e.g. import './App.css';
- Import paths must match your files exactly, including extension for .jsx/.css (e.g. import TaskList from './components/TaskList.jsx').
- At most 10 files, each under 250 lines. Double-check JSX is well formed: every tag closed, one root per return, braces balanced.`;

export function codingPrompt(spec, plan, testIds) {
  const guide = GUIDES[spec.project_type] ?? DEFAULT_GUIDE;
  return `Build this MVP.

REQUIREMENT SPEC:
${JSON.stringify(spec, null, 2)}

IMPLEMENTATION PLAN:
${JSON.stringify(plan, null, 2)}

REQUIRED data-testid VALUES (put each as a data-testid attribute with this EXACT value on the matching element; repeated items share one value):
${JSON.stringify(testIds)}

PROJECT-TYPE GUIDE:
${guide}

DESIGN: modern and professional. Define a colour palette with CSS variables, consistent spacing, rounded cards, subtle shadows, hover and focus states, readable typography, fully responsive (flex/grid + a media query for narrow screens). Realistic content, no lorem ipsum. Every feature in the spec must be visibly working.

${RULES}

OUTPUT FORMAT: for every file write
<file path="src/App.jsx">
...full file content...
</file>
Nothing outside <file> blocks.`;
}
