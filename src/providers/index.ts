import { createAnthropicProvider } from "./anthropic.js";
import { createGeminiProvider } from "./gemini.js";
import { createOpenAIProvider } from "./openai.js";
import type { ModelProvider } from "./types.js";
import type { ProviderId } from "../types.js";

export type ProviderRegistry = Record<ProviderId, ModelProvider>;

export function createDefaultProviders(): ProviderRegistry {
  return {
    openai: createOpenAIProvider(),
    anthropic: createAnthropicProvider(),
    gemini: createGeminiProvider()
  };
}

export function availableProviders(registry: ProviderRegistry): ProviderId[] {
  return (Object.keys(registry) as ProviderId[]).filter(provider => registry[provider].isAvailable());
}

export * from "./types.js";
export * from "./openai.js";
export * from "./anthropic.js";
export * from "./gemini.js";
export * from "./errors.js";
