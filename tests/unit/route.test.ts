import { describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/config/defaults.js";
import { routeModel } from "../../src/router/route.js";
import type { ProviderRegistry } from "../../src/providers/index.js";

const providers = {
  openai: { id: "openai", isAvailable: () => true, generateStructured: async () => undefined as never },
  anthropic: { id: "anthropic", isAvailable: () => false, generateStructured: async () => undefined as never },
  gemini: { id: "gemini", isAvailable: () => false, generateStructured: async () => undefined as never }
} satisfies ProviderRegistry;

describe("routeModel", () => {
  it("escalates high-risk tasks to max", () => {
    const route = routeModel(
      {
        tool: "plan",
        task: "Add auth migration and update permissions",
        fileCount: 3,
        totalInputTokensEstimate: 1000
      },
      defaultConfig,
      providers
    );

    expect(route.provider).toBe("openai");
    expect(route.modelTier).toBe("max");
    expect(route.routingReason).toContain("auth");
  });

  it("keeps localized work on balanced", () => {
    const route = routeModel(
      {
        tool: "review",
        task: "Fix typo in button label",
        fileCount: 1,
        totalInputTokensEstimate: 500
      },
      defaultConfig,
      providers
    );

    expect(route.modelTier).toBe("balanced");
  });
});
