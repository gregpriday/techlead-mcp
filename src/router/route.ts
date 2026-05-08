import type { TechLeadConfig } from "../config/defaults.js";
import { getModelForTier } from "../config/modelCatalog.js";
import type { ProviderRegistry } from "../providers/index.js";
import type { ModelTier, ProviderId, ProviderPreference, RouteMetadata } from "../types.js";
import { assessRisk, type DeterministicRouteInput } from "./deterministicRules.js";
import { runOptionalLlmRouter, type RouterOutput } from "./llmRouter.js";

export type RouteInput = DeterministicRouteInput & {
  providerPreference?: ProviderPreference;
};

export type RouteDecision = RouteMetadata & {
  fallbackProviders: ProviderId[];
  fallbackModels: Partial<Record<ProviderId, string>>;
  riskSignals: string[];
};

export async function routeModel(
  input: RouteInput,
  config: TechLeadConfig,
  providers: ProviderRegistry,
  signal?: AbortSignal
): Promise<RouteDecision> {
  const assessment = assessRisk(input);
  const available = config.providerOrder.filter(provider => providers[provider]?.isAvailable());
  const notes: string[] = [];

  if (available.length === 0) {
    throw new Error(
      "No model providers are configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY."
    );
  }

  const llmRoute = await runRouterIfEnabled(input, assessment.riskSignals, config, providers, signal, notes);
  const preferredProvider = input.providerPreference?.provider;
  const provider = chooseProvider({
    preferred: preferredProvider,
    llmProvider: config.routing.enabled ? llmRoute?.provider : undefined,
    defaultProvider: config.defaultProvider,
    routingEnabled: config.routing.enabled,
    tool: input.tool,
    riskSignals: assessment.riskSignals,
    available,
    providerOrder: config.providerOrder,
    notes
  });

  if (!provider) {
    throw new Error(
      "No model providers are configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY."
    );
  }

  const modelTier = chooseModelTier(input.providerPreference, config, assessment, llmRoute);
  const effort = chooseEffort(input.providerPreference, assessment.effort, modelTier, llmRoute);
  const model = input.providerPreference?.model ?? getModelForTier(config.models, provider, modelTier);

  if (config.routing.neverUseTinyForPlanOrReview && isRouterModel(model, config)) {
    throw new Error(
      `Model ${model} is configured as a router/tiny model and cannot be used for techlead.${input.tool}.`
    );
  }

  return {
    provider,
    model,
    modelTier,
    effort,
    routingReason: buildRoutingReason(assessment.reason, llmRoute, notes),
    fallbackProviders: available.filter(item => item !== provider),
    fallbackModels: Object.fromEntries(
      available
        .filter(item => item !== provider)
        .map(item => [item, getModelForTier(config.models, item, modelTier)])
    ) as Partial<Record<ProviderId, string>>,
    riskSignals: assessment.riskSignals
  };
}

async function runRouterIfEnabled(
  input: RouteInput,
  riskSignals: string[],
  config: TechLeadConfig,
  providers: ProviderRegistry,
  signal: AbortSignal | undefined,
  notes: string[]
): Promise<RouterOutput | undefined> {
  if (!config.routing.enabled || !config.routing.optionalLlmRouter) return undefined;

  try {
    const route = await runOptionalLlmRouter(
      {
        ...input,
        riskSignals
      },
      config,
      providers,
      signal
    );
    if (!route) {
      notes.push("optional LLM router was unavailable, so deterministic routing was used");
    }
    return route;
  } catch (error) {
    notes.push(`optional LLM router failed, so deterministic routing was used: ${(error as Error).message}`);
    return undefined;
  }
}

function chooseProvider(input: {
  preferred: ProviderPreference["provider"] | undefined;
  llmProvider: ProviderId | undefined;
  defaultProvider: ProviderId | "auto";
  routingEnabled: boolean;
  tool: RouteInput["tool"];
  riskSignals: string[];
  available: ProviderId[];
  providerOrder: ProviderId[];
  notes: string[];
}): ProviderId | undefined {
  if (input.preferred && input.preferred !== "auto") {
    if (input.available.includes(input.preferred)) return input.preferred;
    input.notes.push(`preferred provider ${input.preferred} is unavailable`);
  }

  if (input.llmProvider) {
    if (input.available.includes(input.llmProvider)) return input.llmProvider;
    input.notes.push(`optional LLM router suggested unavailable provider ${input.llmProvider}`);
  }

  if (input.defaultProvider !== "auto") {
    if (input.available.includes(input.defaultProvider)) return input.defaultProvider;
    input.notes.push(`default provider ${input.defaultProvider} is unavailable`);
  }

  if (input.routingEnabled) {
    if (input.tool === "review" && input.riskSignals.length > 0 && input.available.includes("anthropic")) {
      input.notes.push("auto-selected Anthropic for high-risk review");
      return "anthropic";
    }

    if (input.available.includes("openai")) {
      input.notes.push("auto-selected OpenAI for general planning/review");
      return "openai";
    }
  }

  return input.available[0] ?? input.providerOrder.find(provider => input.available.includes(provider));
}

function chooseModelTier(
  preference: ProviderPreference | undefined,
  config: TechLeadConfig,
  assessment: ReturnType<typeof assessRisk>,
  llmRoute: RouterOutput | undefined
): ModelTier {
  const requestedTier = preference?.modelTier;
  const deterministicMustUseMax =
    config.routing.enabled && config.routing.escalateOnRisk && assessment.riskSignals.length > 0;

  if (requestedTier === "max") return "max";
  if (deterministicMustUseMax) return "max";
  if (requestedTier === "balanced") return "balanced";
  if (!config.routing.enabled) return config.routing.defaultTier;

  return llmRoute?.modelTier ?? config.routing.defaultTier;
}

function chooseEffort(
  preference: ProviderPreference | undefined,
  deterministicEffort: string,
  modelTier: ModelTier,
  llmRoute: RouterOutput | undefined
): string {
  const requestedEffort = preference?.effort;
  const minimumEffort = modelTier === "max" ? deterministicEffort : "medium";

  if (requestedEffort && requestedEffort !== "auto") {
    return higherEffort(requestedEffort, minimumEffort);
  }

  return higherEffort(llmRoute?.effort ?? deterministicEffort, minimumEffort);
}

function higherEffort(left: string, right: string): string {
  const rank: Record<string, number> = {
    low: 0,
    medium: 1,
    high: 2,
    xhigh: 3,
    max: 4
  };

  return (rank[left] ?? 1) >= (rank[right] ?? 1) ? left : right;
}

function isRouterModel(model: string, config: TechLeadConfig): boolean {
  return Object.values(config.models).some(providerModels => providerModels.router === model);
}

function buildRoutingReason(
  deterministicReason: string,
  llmRoute: RouterOutput | undefined,
  notes: string[]
): string {
  const parts = [deterministicReason];

  if (llmRoute) {
    parts.push(
      `optional LLM router suggested ${llmRoute.provider}/${llmRoute.modelTier} at ${llmRoute.effort} effort (confidence ${llmRoute.confidence}): ${llmRoute.reason}`
    );
  }

  parts.push(...notes);
  return parts.join("; ");
}
