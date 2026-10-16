import { SUPPORTED_PROJECT_TYPES } from '@fyp/shared';

export const REQUIREMENTS_SYSTEM = `You are the Requirements Agent of an AI software house.
Convert a client's request into a structured requirement spec for a SIMPLE front-end-only web MVP
(React, no backend, data kept in component state / localStorage / mock data).
Reply with ONE JSON object and nothing else (no markdown fences, no commentary).`;

export function requirementsPrompt(inputText) {
  return `CLIENT REQUEST:
"""
${inputText}
"""

Return JSON with exactly this shape:
{
  "schema_version": "1.0",
  "project_name": "short human-readable name",
  "project_type": one of ${JSON.stringify(SUPPORTED_PROJECT_TYPES)} or "unsupported",
  "summary": "one or two sentences",
  "target_users": ["who uses the app"],
  "features": [ { "id": "F1", "name": "short name", "description": "what the user can do", "priority": "must" | "should" | "could" } ],
  "design_preferences": { "style": "modern", "responsive": true, "color_hint": "optional, e.g. warm earthy" },
  "data_needs": ["what data the app shows or stores"],
  "assumptions": [ { "statement": "what you assumed", "basis": "missing_detail" | "ambiguous_detail" | "default_choice" } ],
  "open_questions": ["things a human should confirm later"],
  "out_of_scope_signals": ["phrases from the request that need a backend, payments, real auth, etc."],
  "confidence": 0.0 to 1.0
}

Rules:
- 3 to 8 features, ids F1, F2, ... One feature per capability the client asked for. Include implied essentials (e.g. navigation, empty states) only if they matter.
- Never ask the client questions. When details are missing, make a sensible choice and record it in "assumptions".
- project_type guide: task lists/to-do apps -> task_manager; restaurant/cafe sites -> restaurant_website; agencies/small businesses/services -> business_website; forms for bookings -> booking_form; personal sites -> portfolio_website; product listings -> product_catalog; events -> event_website; student progress/grades/timetables -> student_dashboard; generic add/edit/delete lists -> crud_mock_data.
- Use "unsupported" only for requests that truly need banking, payments, medical diagnosis, large e-commerce, ERP, social networks, real authentication, real-time distributed systems or native mobile apps. If the request is mostly supportable but includes one such element, keep the supported project_type and list the element in out_of_scope_signals.`;
}
