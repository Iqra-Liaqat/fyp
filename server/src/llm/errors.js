export class LlmError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LlmError';
    this.code = code; // LLM_TIMEOUT | LLM_EMPTY_RESPONSE | LLM_INVALID_JSON | LLM_SCHEMA_MISMATCH | LLM_PROVIDER_ERROR | LLM_NOT_CONFIGURED | LLM_NOT_IMPLEMENTED
    this.details = details;
  }
}
