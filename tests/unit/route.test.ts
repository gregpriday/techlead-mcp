import { describe, expect, it, vi } from "vitest";
import { defaultConfig, type TechLeadConfig } from "../../src/config/defaults.js";
import type { ProviderRegistry } from "../../src/providers/index.js";
import type { GenerateStructuredInput, GenerateStructuredResult, ModelProvider } from "../../src/providers/types.js";
import { routeModel } from "../../src/router/route.js";
import type { ProviderId } from "../../src/types.js";

type ConfigOverrides = Omit<Partial<TechLeadConfig>, "routing" | "models"> & {
  routing?: Partial<TechLeadConfig["routing"]>;
  models?: Partial<TechLeadConfig["models"]>;
};

const geminiBalancedRoute = {
  provider: "gemini",
  modelTier: "balanced",
  effort: "medium",
  reason: "Gemini is the cheaper frontier path for this small task",
  confidence: 0.8
};

function createStructuredMock(output: unknown) {
  const call = vi.fn(async (_input: GenerateStructuredInput) => ({
    output,
    rawText: "{}"
  }));
  const generateStructured: ModelProvider["generateStructured"] = async <T>(
    input: GenerateStructuredInput
  ): Promise<GenerateStructuredResult<T>> => call(input) as Promise<GenerateStructuredResult<T>>;

  return { call, generateStructured };
}

function createProviders(
  overrides: Partial<Record<ProviderId, Partial<ModelProvider>>> = {}
): ProviderRegistry {
  const unavailableGenerate = async <T>(): Promise<GenerateStructuredResult<T>> => {
    throw new Error("provider should not be called");
  };

  return {
    openai: {
      id: "openai",
      isAvailable: () => true,
      generateStructured: unavailableGenerate,
      ...overrides.openai
    },
    anthropic: {
      id: "anthropic",
      isAvailable: () => false,
      generateStructured: unavailableGenerate,
      ...overrides.anthropic
    },
    gemini: {
      id: "gemini",
      isAvailable: () => false,
      generateStructured: unavailableGenerate,
      ...overrides.gemini
    }
  };
}

function configWith(overrides: ConfigOverrides): TechLeadConfig {
  return {
    ...defaultConfig,
    ...overrides,
    routing: {
      ...defaultConfig.routing,
      ...overrides.routing
    },
    models: {
      ...defaultConfig.models,
      ...overrides.models
    }
  };
}

describe("routeModel", () => {
  it("escalates high-risk tasks to max", async () => {
    const route = await routeModel(
      {
        tool: "plan",
        task: "Add auth migration and update permissions",
        fileCount: 3,
        totalInputTokensEstimate: 1000
      },
      defaultConfig,
      createProviders()
    );

    expect(route.provider).toBe("openai");
    expect(route.modelTier).toBe("max");
    expect(route.routingReason).toContain("auth");
  });

  it("keeps localized work on balanced", async () => {
    const route = await routeModel(
      {
        tool: "review",
        task: "Fix typo in button label",
        fileCount: 1,
        totalInputTokensEstimate: 500
      },
      defaultConfig,
      createProviders()
    );

    expect(route.modelTier).toBe("balanced");
  });

  it("does not call the cheap router when optionalLlmRouter is disabled", async () => {
    const router = createStructuredMock({
      provider: "gemini",
      modelTier: "max",
      effort: "high",
      reason: "test route",
      confidence: 0.9
    });

    await routeModel(
      {
        tool: "plan",
        task: "Fix typo in button label",
        fileCount: 1,
        totalInputTokensEstimate: 500
      },
      defaultConfig,
      createProviders({ openai: { generateStructured: router.generateStructured } })
    );

    expect(router.call).not.toHaveBeenCalled();
  });

  it("uses the cheap router suggestion when enabled and safe", async () => {
    const router = createStructuredMock(geminiBalancedRoute);

    const route = await routeModel(
      {
        tool: "plan",
        task: "Update copy in a settings panel",
        fileCount: 2,
        totalInputTokensEstimate: 1200
      },
      configWith({ routing: { optionalLlmRouter: true } }),
      createProviders({
        openai: { generateStructured: router.generateStructured },
        gemini: { isAvailable: () => true }
      })
    );

    expect(router.call).toHaveBeenCalledTimes(1);
    expect(route.provider).toBe("gemini");
    expect(route.modelTier).toBe("balanced");
    expect(route.routingReason).toContain("optional LLM router suggested gemini/balanced");
  });

  it("does not let the cheap router downgrade deterministic high-risk work", async () => {
    const router = createStructuredMock({
      provider: "gemini",
      modelTier: "balanced",
      effort: "medium",
      reason: "Looks small",
      confidence: 0.7
    });

    const route = await routeModel(
      {
        tool: "review",
        task: "Review auth permissions and payment deletion behavior",
        fileCount: 2,
        totalInputTokensEstimate: 1500
      },
      configWith({ routing: { optionalLlmRouter: true } }),
      createProviders({
        openai: { generateStructured: router.generateStructured },
        gemini: { isAvailable: () => true }
      })
    );

    expect(route.provider).toBe("gemini");
    expect(route.modelTier).toBe("max");
    expect(route.effort).toBe("high");
    expect(route.routingReason).toContain("auth");
  });

  it("respects routing.enabled=false and defaultTier", async () => {
    const route = await routeModel(
      {
        tool: "plan",
        task: "Add auth migration and update permissions",
        fileCount: 3,
        totalInputTokensEstimate: 1000
      },
      configWith({
        routing: {
          enabled: false,
          defaultTier: "balanced"
        }
      }),
      createProviders()
    );

    expect(route.modelTier).toBe("balanced");
  });

  it("respects defaultTier for low-risk deterministic routing", async () => {
    const route = await routeModel(
      {
        tool: "plan",
        task: "Fix typo in button label",
        fileCount: 1,
        totalInputTokensEstimate: 500
      },
      configWith({
        routing: {
          defaultTier: "max"
        }
      }),
      createProviders()
    );

    expect(route.modelTier).toBe("max");
  });

  it("falls back when the preferred provider is unavailable", async () => {
    const route = await routeModel(
      {
        tool: "plan",
        task: "Fix typo in button label",
        fileCount: 1,
        totalInputTokensEstimate: 500,
        providerPreference: {
          provider: "anthropic"
        }
      },
      defaultConfig,
      createProviders()
    );

    expect(route.provider).toBe("openai");
    expect(route.routingReason).toContain("preferred provider anthropic is unavailable");
  });

  it("rejects configured router models for plan and review calls", async () => {
    await expect(
      routeModel(
        {
          tool: "plan",
          task: "Fix typo in button label",
          fileCount: 1,
          totalInputTokensEstimate: 500,
          providerPreference: {
            provider: "openai",
            model: defaultConfig.models.openai.router
          }
        },
        defaultConfig,
        createProviders()
      )
    ).rejects.toThrow("router/tiny model");
  });

  it("auto-selects OpenAI for broad low-risk planning when available", async () => {
    const route = await routeModel(
      {
        tool: "plan",
        task: "Create an implementation plan for a settings panel cleanup",
        fileCount: 4,
        totalInputTokensEstimate: 2000
      },
      defaultConfig,
      createProviders({
        anthropic: { isAvailable: () => true }
      })
    );

    expect(route.provider).toBe("openai");
    expect(route.routingReason).toContain("auto-selected OpenAI");
  });

  it("auto-selects Anthropic for high-risk review when available", async () => {
    const route = await routeModel(
      {
        tool: "review",
        task: "Review auth permission changes for subtle security bugs",
        fileCount: 4,
        totalInputTokensEstimate: 2000
      },
      defaultConfig,
      createProviders({
        anthropic: { isAvailable: () => true }
      })
    );

    expect(route.provider).toBe("anthropic");
    expect(route.modelTier).toBe("max");
    expect(route.routingReason).toContain("auto-selected Anthropic");
  });
});
