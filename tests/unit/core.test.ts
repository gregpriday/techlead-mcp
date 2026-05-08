import { describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/config/defaults.js";
import { plan } from "../../src/core/plan.js";
import { review } from "../../src/core/review.js";
import type { ProviderRegistry } from "../../src/providers/index.js";
import type { ModelProvider, ModelUsage } from "../../src/providers/types.js";
import type { TechLeadPlanOutput, TechLeadReviewOutput } from "../../src/types.js";

function providerWith(output: unknown, usage?: ModelUsage): ModelProvider {
  return {
    id: "openai",
    isAvailable: () => true,
    async generateStructured<T>() {
      return { output: output as T, rawText: JSON.stringify(output), usage };
    }
  };
}

function providers(output: unknown, usage?: ModelUsage): ProviderRegistry {
  return {
    openai: providerWith(output, usage),
    anthropic: { id: "anthropic", isAvailable: () => false, generateStructured: async () => undefined as never },
    gemini: { id: "gemini", isAvailable: () => false, generateStructured: async () => undefined as never }
  };
}

const baseRoute = {
  provider: "openai" as const,
  model: "test-model",
  modelTier: "balanced" as const,
  effort: "medium",
  routingReason: "test"
};

const planOutput: TechLeadPlanOutput = {
  schemaVersion: "1.0",
  tool: "techlead.plan",
  route: baseRoute,
  taskUnderstanding: {
    summary: "Add feature",
    goals: ["Implement requested behavior"],
    nonGoals: ["Rewrite unrelated code"],
    assumptions: ["Provided file is relevant"]
  },
  contextAssessment: {
    sufficientContext: true,
    missingContext: [],
    keyFiles: [{ path: "src.ts", relevance: "Target file" }],
    importantFindings: []
  },
  implementationPlan: [
    {
      stepId: "P1",
      title: "Update source",
      targetFiles: ["src.ts"],
      instructions: ["Make a focused change"],
      rationale: "Matches task scope",
      riskLevel: "low"
    }
  ],
  executorGuidance: {
    preferredApproach: "Minimal patch",
    avoid: ["Unrelated edits"],
    codingStandards: ["Follow existing style"],
    fileReferenceRules: ["Use cwd-relative paths"]
  },
  verificationPlan: {
    testsToRun: ["npm test"],
    manualChecks: ["Inspect output"],
    expectedOutcomes: ["Tests pass"]
  },
  riskRegister: [],
  acceptanceCriteria: ["Task is satisfied"],
  openQuestions: [],
  handoffPromptForExecutor: "Implement the plan.",
  confidence: { score: 0.8, explanation: "Enough context" },
  markdown: "Plan ready."
};

const reviewOutput: TechLeadReviewOutput = {
  schemaVersion: "1.0",
  tool: "techlead.review",
  route: baseRoute,
  verdict: "approved",
  summary: "Looks correct.",
  planAdherence: { followedPlan: true, deviations: [] },
  blockingIssues: [],
  nonBlockingIssues: [],
  testAssessment: {
    testsProvided: true,
    testsPassed: true,
    missingTests: [],
    suspiciousTestGaps: []
  },
  approvalChecklist: [{ item: "Task satisfied", status: "pass", evidence: "Diff matches request" }],
  nextActionsForExecutor: [],
  confidence: { score: 0.8, explanation: "Diff and tests provided" },
  markdown: "Approved."
};

describe("core plan/review", () => {
  it("returns structured plan output with routed metadata", async () => {
    const output = await plan(
      {
        cwd: "remote",
        task: "Add feature",
        files: [{ path: "src.ts", content: "export const value = 1;" }]
      },
      {
        config: defaultConfig,
        providers: providers(planOutput, { inputTokens: 1000, outputTokens: 200, totalTokens: 1200 }),
        allowLocalFiles: false
      }
    );

    expect(output.tool).toBe("techlead.plan");
    expect(output.route.provider).toBe("openai");
    expect(output.route.model).toBe(defaultConfig.models.openai.balanced);
    expect(output.usage?.inputTokens).toBe(1000);
    expect(output.cost?.totalUsd).toBe(0.00165);
    expect(output.markdown).toContain("Estimated provider cost: USD $0.001650");
    expect(output.contextSummary?.fileCount).toBe(1);
  });

  it("returns structured review output", async () => {
    const output = await review(
      {
        cwd: "remote",
        task: "Add feature",
        files: [{ path: "src.ts", content: "export const value = 2;" }],
        diff: "diff --git a/src.ts b/src.ts",
        testResults: [{ command: "npm test", status: "passed", output: "ok" }]
      },
      {
        config: defaultConfig,
        providers: providers(reviewOutput, { inputTokens: 2000, outputTokens: 100, totalTokens: 2100 }),
        allowLocalFiles: false
      }
    );

    expect(output.tool).toBe("techlead.review");
    expect(output.verdict).toBe("approved");
    expect(output.route.model).toBe(defaultConfig.models.openai.balanced);
    expect(output.usage?.costUsd).toBe(0.00195);
    expect(output.cost?.pricingSource).toBe("configured");
    expect(output.contextSummary?.changedFileCount).toBe(0);
  });
});
