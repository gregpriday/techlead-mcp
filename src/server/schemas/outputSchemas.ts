import { z } from "zod";

export const routeSchema = z.object({
  provider: z.enum(["openai", "anthropic", "gemini"]),
  model: z.string(),
  modelTier: z.enum(["balanced", "max"]),
  effort: z.string(),
  routingReason: z.string()
});

export const confidenceSchema = z.object({
  score: z.number().min(0).max(1),
  explanation: z.string()
});

export const usageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  cachedInputTokens: z.number().int().nonnegative().optional(),
  cacheCreationInputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  reasoningTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional()
});

export const costSchema = z.object({
  currency: z.literal("USD"),
  totalUsd: z.number().nonnegative().optional(),
  inputUsd: z.number().nonnegative().optional(),
  cachedInputUsd: z.number().nonnegative().optional(),
  cacheCreationInputUsd: z.number().nonnegative().optional(),
  outputUsd: z.number().nonnegative().optional(),
  inputPerMillion: z.number().nonnegative().optional(),
  cachedInputPerMillion: z.number().nonnegative().optional(),
  cacheCreationInputPerMillion: z.number().nonnegative().optional(),
  outputPerMillion: z.number().nonnegative().optional(),
  pricingSource: z.enum(["configured", "unavailable"]),
  note: z.string()
});

export const techLeadPlanOutputSchema = z.object({
  schemaVersion: z.literal("1.0"),
  tool: z.literal("techlead.plan"),
  route: routeSchema,
  taskUnderstanding: z.object({
    summary: z.string(),
    goals: z.array(z.string()),
    nonGoals: z.array(z.string()),
    assumptions: z.array(z.string())
  }),
  contextAssessment: z.object({
    sufficientContext: z.boolean(),
    missingContext: z.array(z.string()),
    keyFiles: z.array(
      z.object({
        path: z.string(),
        relevance: z.string()
      })
    ),
    importantFindings: z.array(
      z.object({
        finding: z.string(),
        file: z.string().optional(),
        evidence: z.string().optional()
      })
    )
  }),
  implementationPlan: z.array(
    z.object({
      stepId: z.string(),
      title: z.string(),
      targetFiles: z.array(z.string()),
      instructions: z.array(z.string()),
      rationale: z.string(),
      riskLevel: z.enum(["low", "medium", "high"]),
      dependsOn: z.array(z.string()).optional()
    })
  ),
  executorGuidance: z.object({
    preferredApproach: z.string(),
    avoid: z.array(z.string()),
    codingStandards: z.array(z.string()),
    fileReferenceRules: z.array(z.string())
  }),
  verificationPlan: z.object({
    testsToRun: z.array(z.string()),
    manualChecks: z.array(z.string()),
    expectedOutcomes: z.array(z.string())
  }),
  riskRegister: z.array(
    z.object({
      risk: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      mitigation: z.string()
    })
  ),
  acceptanceCriteria: z.array(z.string()),
  openQuestions: z.array(
    z.object({
      question: z.string(),
      blocking: z.boolean(),
      suggestedWayToResolve: z.string()
    })
  ),
  handoffPromptForExecutor: z.string().optional(),
  confidence: confidenceSchema,
  markdown: z.string().optional(),
  usage: usageSchema.optional(),
  cost: costSchema.optional()
});

export const techLeadReviewOutputSchema = z.object({
  schemaVersion: z.literal("1.0"),
  tool: z.literal("techlead.review"),
  route: routeSchema,
  verdict: z.enum(["approved", "needs_changes", "blocked", "insufficient_context"]),
  summary: z.string(),
  planAdherence: z.object({
    followedPlan: z.boolean(),
    deviations: z.array(
      z.object({
        description: z.string(),
        acceptable: z.boolean(),
        reason: z.string()
      })
    )
  }),
  blockingIssues: z.array(
    z.object({
      issueId: z.string(),
      title: z.string(),
      severity: z.enum(["medium", "high", "critical"]),
      category: z.enum([
        "correctness",
        "architecture",
        "security",
        "performance",
        "types",
        "tests",
        "edge_case",
        "maintainability",
        "plan_adherence"
      ]),
      fileRefs: z.array(z.string()),
      evidence: z.string(),
      suggestedFix: z.string()
    })
  ),
  nonBlockingIssues: z.array(
    z.object({
      title: z.string(),
      category: z.string(),
      fileRefs: z.array(z.string()),
      note: z.string()
    })
  ),
  testAssessment: z.object({
    testsProvided: z.boolean(),
    testsPassed: z.boolean().optional(),
    missingTests: z.array(z.string()),
    suspiciousTestGaps: z.array(z.string())
  }),
  approvalChecklist: z.array(
    z.object({
      item: z.string(),
      status: z.enum(["pass", "fail", "unknown"]),
      evidence: z.string().optional()
    })
  ),
  nextActionsForExecutor: z.array(z.string()),
  fixPromptForExecutor: z.string().optional(),
  confidence: confidenceSchema,
  markdown: z.string().optional(),
  usage: usageSchema.optional(),
  cost: costSchema.optional()
});

export type TechLeadPlanOutput = z.infer<typeof techLeadPlanOutputSchema>;
export type TechLeadReviewOutput = z.infer<typeof techLeadReviewOutputSchema>;
