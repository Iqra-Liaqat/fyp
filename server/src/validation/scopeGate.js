const SUGGESTION =
  'This request is outside the supported MVP scope. I can generate a simplified web-based prototype instead: a front-end only app with mock data (no payments, real authentication, backend or live data).';

/** Deterministic gate over the Requirements Agent's classification. */
export function runScopeGate(spec) {
  const signals = spec.out_of_scope_signals;
  if (spec.project_type === 'unsupported') {
    return {
      status: 'rejected',
      project_type: null,
      matched_out_of_scope: [],
      reasons: signals.length ? signals : ['The request does not match any supported MVP category'],
      simplified_suggestion: SUGGESTION,
      retained_feature_ids: [],
    };
  }
  if (signals.length) {
    return {
      status: 'simplified',
      project_type: spec.project_type,
      matched_out_of_scope: [],
      reasons: signals,
      simplified_suggestion: SUGGESTION,
      retained_feature_ids: spec.features.map((f) => f.id),
    };
  }
  return {
    status: 'supported',
    project_type: spec.project_type,
    matched_out_of_scope: [],
    reasons: [],
    simplified_suggestion: null,
    retained_feature_ids: spec.features.map((f) => f.id),
  };
}
