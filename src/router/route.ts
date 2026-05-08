import type { TechLeadConfig } from "../config/defaults.js";
import { getModelForTier } from "../config/modelCatalog.js";
import type { ProviderRegistry } from "../providers/index.js";
import type { ModelTier, ProviderId, ProviderPreference, RouteMetadata, ToolKind } from "../types.js";
import { assessRisk, type DeterministicRouteInput } from "./deterministicRules.js";

export type RouteInput = DeterministicRouteInput & {
  providerPreference?: ProviderPreference;
};

export type RouteDecision = RouteMetadata & {
  fallbackProviders: ProviderId[];
  fallbackModels: Partial<Record<ProviderId, string>>;
  riskSignals: string[];
};

export function routeModel(
  input: RouteInput,
  config: TechLeadConfig,
  providers: ProviderRegistry
): RouteDecision {
  const assessment = assessRisk(input);
  const available = config.providerOrder.filter(provider => providers[provider]?.isAvailable());
  const preferredProvider = input.providerPreference?.provider;
  const provider = chooseProvider(preferredProvider, config.defaultProvider, available, config.providerOrder);

  if (!provider) {
    throw new Error(
      "No model providers are configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY."
    );
  }

  const requestedTier = input.providerPreference?.modelTier;
  const modelTier: ModelTier =
    requestedTier && requestedTier !== "auto" ? requestedTier : config.routing.escalateOnRisk ? assessment.modelTier : config.routing.defaultTier;

  const effort =
    input.providerPreference?.effort && input.providerPreference.effort !== "auto"
      ? input.providerPreference.effort
      : assessment.effort;
  const model = input.providerPreference?.model ?? getModelForTier(config.models, provider, modelTier);

  return {
    provider,
    model,
    modelTier,
    effort,
    routingReason: assessment.reason,
    fallbackProviders: available.filter(item => item !== provider),
    fallbackModels: Object.fromEntries(
      available
        .filter(item => item !== provider)
        .map(item => [item, getModelForTier(config.models, item, modelTier)])
    ) as Partial<Record<ProviderId, string>>,
    riskSignals: assessment.riskSignals
  };
}

function chooseProvider(
  preferred: ProviderPreference["provider"] | undefined,
  defaultProvider: ProviderId | "auto",
  available: ProviderId[],
  providerOrder: ProviderId[]
): ProviderId | undefined {
  if (preferred && preferred !== "auto" && available.includes(preferred)) return preferred;
  if (defaultProvider !== "auto" && available.includes(defaultProvider)) return defaultProvider;
  return available[0] ?? providerOrder.find(provider => available.includes(provider));
}
