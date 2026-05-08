import type { ModelTier, ProviderId } from "../types.js";

export type ProviderModelCatalog = {
  max: string;
  balanced: string;
  router: string;
};

export type ModelCatalog = Record<ProviderId, ProviderModelCatalog>;

export const defaultModelCatalog: ModelCatalog = {
  openai: {
    max: "gpt-5.5",
    balanced: "gpt-5.4-mini",
    router: "gpt-5.4-nano"
  },
  anthropic: {
    max: "claude-opus-4-7",
    balanced: "claude-sonnet-4-6",
    router: "claude-haiku-4-5"
  },
  gemini: {
    max: "gemini-3.1-pro-preview",
    balanced: "gemini-3-flash-preview",
    router: "gemini-3.1-flash-lite"
  }
};

export function getModelForTier(
  catalog: ModelCatalog,
  provider: ProviderId,
  tier: ModelTier
): string {
  return catalog[provider][tier];
}
