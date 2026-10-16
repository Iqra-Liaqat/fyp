import { LlmError } from '../errors.js';
import { createMockProvider } from './mock.js';
import { createAnthropicProvider } from './anthropic.js';

// One adapter per file implementing `complete()`. OpenAI-compatible is future work.
function notYet(name) {
  return () => ({
    name,
    async complete() {
      throw new LlmError('LLM_NOT_IMPLEMENTED', `Provider "${name}" is not implemented yet`);
    },
  });
}

export const PROVIDER_FACTORIES = {
  mock: () => createMockProvider(),
  anthropic: (config) => createAnthropicProvider(config),
  openai_compatible: notYet('openai_compatible'),
};

export function createProvider(config, factories = PROVIDER_FACTORIES) {
  const factory = factories[config.LLM_PROVIDER];
  if (!factory) throw new LlmError('LLM_NOT_CONFIGURED', `Unknown LLM_PROVIDER "${config.LLM_PROVIDER}"`);
  return factory(config);
}
