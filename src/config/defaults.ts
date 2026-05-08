import type { ModelCatalog, ProviderModelCatalog } from "./modelCatalog.js";
import { defaultModelCatalog } from "./modelCatalog.js";
import type { ProviderId } from "../types.js";
import type { TokenPrice } from "../telemetry/cost.js";

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
    allowedRoots: string[];
    restrictLocalReadsToAllowedRoots: boolean;
    allowHiddenFiles: boolean;
    allowHiddenDirectories: boolean;
  };
  telemetry: {
    enabled: boolean;
    logUsage: boolean;
    logCosts: boolean;
    logRawModelOutputs: boolean;
  };
  pricing: {
    enabled: boolean;
    modelPrices: Record<string, TokenPrice>;
  };
  github: {
    apiBaseUrl: string;
    tokenEnvVars: string[];
    maxComments: number;
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
    logRawInputs: false,
    allowedRoots: [process.cwd()],
    restrictLocalReadsToAllowedRoots: true,
    allowHiddenFiles: false,
    allowHiddenDirectories: false
  },
  telemetry: {
    enabled: true,
    logUsage: true,
    logCosts: true,
    logRawModelOutputs: false
  },
  pricing: {
    enabled: true,
    modelPrices: {
      "gpt-5.5": {
        inputPerMillion: 5,
        cachedInputPerMillion: 0.5,
        outputPerMillion: 30,
        source: "OpenAI configured default pricing for gpt-5.5 standard text tokens."
      },
      "gpt-5.4-mini": {
        inputPerMillion: 0.75,
        cachedInputPerMillion: 0.075,
        outputPerMillion: 4.5,
        source: "OpenAI configured default pricing for gpt-5.4-mini standard text tokens."
      },
      "gpt-5.4-nano": {
        inputPerMillion: 0.2,
        cachedInputPerMillion: 0.02,
        outputPerMillion: 1.25,
        source: "OpenAI configured default pricing for gpt-5.4-nano standard text tokens."
      },
      "gpt-5.2": {
        inputPerMillion: 1.75,
        cachedInputPerMillion: 0.175,
        outputPerMillion: 14,
        source: "OpenAI pricing page, standard text token rates."
      },
      "gpt-5.2-codex": {
        inputPerMillion: 1.75,
        cachedInputPerMillion: 0.175,
        outputPerMillion: 14,
        source: "OpenAI pricing page, standard text token rates."
      },
      "claude-opus-4-7": {
        inputPerMillion: 5,
        cacheCreationInputPerMillion: 6.25,
        cachedInputPerMillion: 0.5,
        outputPerMillion: 25,
        source: "Anthropic pricing page, standard Claude Opus 4.7 token rates."
      },
      "claude-sonnet-4-6": {
        inputPerMillion: 3,
        cacheCreationInputPerMillion: 3.75,
        cachedInputPerMillion: 0.3,
        outputPerMillion: 15,
        source: "Anthropic pricing page, standard Claude Sonnet 4.6 token rates."
      },
      "claude-haiku-4-5": {
        inputPerMillion: 1,
        cacheCreationInputPerMillion: 1.25,
        cachedInputPerMillion: 0.1,
        outputPerMillion: 5,
        source: "Anthropic pricing page, standard Claude Haiku 4.5 token rates."
      },
      "gemini-3.1-pro-preview": {
        inputPerMillion: 2,
        cachedInputPerMillion: 0.2,
        outputPerMillion: 12,
        longContextThresholdTokens: 200_000,
        longInputPerMillion: 4,
        longOutputPerMillion: 18,
        source: "Gemini pricing page, Gemini 3.1 Pro Preview standard text token rates."
      },
      "gemini-3-flash-preview": {
        inputPerMillion: 0.5,
        cachedInputPerMillion: 0.05,
        outputPerMillion: 3,
        source: "Gemini pricing page, Gemini 3 Flash Preview standard text token rates."
      },
      "gemini-3.1-flash-lite": {
        inputPerMillion: 0.25,
        cachedInputPerMillion: 0.025,
        outputPerMillion: 1.5,
        source: "Gemini pricing page, Gemini 3.1 Flash-Lite Preview standard text token rates."
      },
      "gemini-3.1-flash-lite-preview": {
        inputPerMillion: 0.25,
        cachedInputPerMillion: 0.025,
        outputPerMillion: 1.5,
        source: "Gemini pricing page, Gemini 3.1 Flash-Lite Preview standard text token rates."
      }
    }
  },
  github: {
    apiBaseUrl: "https://api.github.com",
    tokenEnvVars: ["TECHLEAD_GITHUB_TOKEN", "GITHUB_TOKEN", "GH_TOKEN"],
    maxComments: 100
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
