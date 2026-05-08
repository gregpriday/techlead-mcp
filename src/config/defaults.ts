import type { ModelCatalog, ProviderModelCatalog } from "./modelCatalog.js";
import { defaultModelCatalog } from "./modelCatalog.js";
import type { ProviderId } from "../types.js";

export type TechLeadConfig = {
  defaultProvider: ProviderId | "auto";
  providerOrder: ProviderId[];
  models: ModelCatalog;
  routing: {
    enabled: boolean;
    routerProvider: ProviderId;
    neverUseTinyForPlanOrReview: boolean;
    defaultTier: "balanced" | "max";
    escalateOnRisk: boolean;
    optionalLlmRouter: boolean;
  };
  context: {
    maxInputTokens: number;
    maxFileTokens: number;
    maxFiles: number;
    allowTruncation: boolean;
    autoLoadInstructions: boolean;
    autoLoadProjectMetadata: boolean;
    maxFileBytes: number;
    maxTotalBytes: number;
  };
  security: {
    redactSecrets: boolean;
    allowEnvFiles: boolean;
    allowSymlinksOutsideCwd: boolean;
    logRawInputs: boolean;
  };
  telemetry: {
    enabled: boolean;
    logUsage: boolean;
    logCosts: boolean;
    logRawModelOutputs: boolean;
  };
  http: {
    port: number;
    host: string;
    bearerToken?: string;
    allowedOrigins: string[];
    rateLimitPerMinute: number;
  };
};

export const defaultConfig: TechLeadConfig = {
  defaultProvider: "auto",
  providerOrder: ["anthropic", "openai", "gemini"],
  models: defaultModelCatalog,
  routing: {
    enabled: true,
    routerProvider: "openai",
    neverUseTinyForPlanOrReview: true,
    defaultTier: "balanced",
    escalateOnRisk: true,
    optionalLlmRouter: false
  },
  context: {
    maxInputTokens: 300_000,
    maxFileTokens: 50_000,
    maxFiles: 80,
    allowTruncation: true,
    autoLoadInstructions: true,
    autoLoadProjectMetadata: true,
    maxFileBytes: 1_000_000,
    maxTotalBytes: 20_000_000
  },
  security: {
    redactSecrets: true,
    allowEnvFiles: false,
    allowSymlinksOutsideCwd: false,
    logRawInputs: false
  },
  telemetry: {
    enabled: true,
    logUsage: true,
    logCosts: true,
    logRawModelOutputs: false
  },
  http: {
    port: 8787,
    host: "127.0.0.1",
    allowedOrigins: ["http://localhost", "http://127.0.0.1"],
    rateLimitPerMinute: 60
  }
};

export function mergeProviderModels(
  base: ModelCatalog,
  override?: Partial<Record<ProviderId, Partial<ProviderModelCatalog>>>
): ModelCatalog {
  return {
    openai: { ...base.openai, ...override?.openai },
    anthropic: { ...base.anthropic, ...override?.anthropic },
    gemini: { ...base.gemini, ...override?.gemini }
  };
}
