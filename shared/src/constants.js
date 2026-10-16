// Single source of truth for scope, limits and security rules.
// Used by the server, the dashboard and the (future) test harness.

export const SCHEMA_VERSION = '1.0';

export const SUPPORTED_PROJECT_TYPES = [
  'landing_page',
  'business_website',
  'portfolio_website',
  'restaurant_website',
  'booking_form',
  'task_manager',
  'student_dashboard',
  'product_catalog',
  'event_website',
  'crud_mock_data',
];
export const UNSUPPORTED_PROJECT_TYPE = 'unsupported';

export const OUT_OF_SCOPE_CATEGORIES = [
  'banking',
  'medical_diagnosis',
  'large_ecommerce',
  'erp',
  'social_network',
  'production_auth',
  'payment_gateway',
  'realtime_distributed',
  'mobile_app',
  'large_scale_backend',
];

export const INPUT_KINDS = ['transcript', 'structured', 'manual'];
export const RUN_MODES = ['live', 'replay'];

// baseline    = no validation/repair loop (control)
// proposed    = static validation + smoke + acceptance + targeted self-repair
// blind_retry = same attempt budget as proposed, but regenerates WITHOUT error feedback (ablation)
export const EXPERIMENT_CONDITIONS = ['baseline', 'proposed', 'blind_retry'];

export const STAGES = [
  'requirements',
  'scope_gate',
  'planning',
  'code_generation',
  'static_validation',
  'build',
  'smoke_test',
  'acceptance_test',
  'repair',
  'preview',
];

// The planner and the coding agent share a locator contract: interactive elements carry data-testid.
export const TESTID_ATTRIBUTE = 'data-testid';

export const GENERATED_PROJECT_RULES = {
  allowedPathPrefix: 'src/',
  allowedExtensions: ['.jsx', '.js', '.css', '.json'],
  // Owned by the fixed template, never by the LLM
  reservedPaths: ['src/main.jsx', 'src/base.css'],
  requiredPaths: ['src/App.jsx'],
  maxFiles: 25,
  maxFileBytes: 60000,
  allowedImports: ['react', 'react-dom', 'react-dom/client'],
  // Regex sources (compiled by the validator in Phase 6). Generated apps must be offline and self-contained.
  bannedPatterns: [
    { id: 'eval', source: String.raw`\beval\s*\(`, message: 'eval() is not allowed' },
    { id: 'new_function', source: String.raw`\bnew\s+Function\b`, message: 'Function constructor is not allowed' },
    { id: 'raw_html', source: String.raw`dangerouslySetInnerHTML|\.innerHTML\s*=`, message: 'Raw HTML injection is not allowed' },
    { id: 'env_access', source: String.raw`process\.env|import\.meta\.env`, message: 'Environment access is not allowed' },
    { id: 'network', source: String.raw`\bfetch\s*\(|\bnew\s+(XMLHttpRequest|WebSocket|EventSource)\b|sendBeacon`, message: 'Network access is not allowed' },
    { id: 'cookies', source: String.raw`document\.cookie`, message: 'Cookie access is not allowed' },
    { id: 'dynamic_import', source: String.raw`\bimport\s*\(|\brequire\s*\(`, message: 'Dynamic import/require is not allowed' },
    { id: 'remote_asset', source: String.raw`src\s*=\s*["']https?:|url\(\s*["']?https?:|@import`, message: 'Remote assets are not allowed' },
  ],
};
