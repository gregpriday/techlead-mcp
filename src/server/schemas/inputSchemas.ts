import { z } from "zod";

export const fileImportanceSchema = z.enum(["critical", "high", "medium", "low"]);
export const fileKindSchema = z.enum([
  "source",
  "test",
  "config",
  "docs",
  "instructions",
  "diff",
  "log",
  "unknown"
]);

export const techLeadFileSchema = z.object({
  path: z.string().min(1),
  content: z.string().optional(),
  summary: z.string().optional(),
  reason: z.string().optional(),
  language: z.string().optional(),
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
  importance: fileImportanceSchema.optional(),
  kind: fileKindSchema.optional()
});

export const instructionFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  source: z.enum(["auto_loaded", "caller_supplied"])
});

export const testResultSchema = z.object({
  command: z.string(),
  status: z.enum(["passed", "failed", "skipped", "unknown"]),
  output: z.string()
});

export const providerPreferenceSchema = z.object({
  provider: z.enum(["openai", "anthropic", "gemini", "auto"]).optional(),
  modelTier: z.enum(["balanced", "max", "auto"]).optional(),
  model: z.string().min(1).optional(),
  effort: z.enum(["low", "medium", "high", "xhigh", "max", "auto"]).optional()
});

const contextBudgetSchema = z.object({
  maxInputTokens: z.number().int().positive().optional(),
  maxFileTokens: z.number().int().positive().optional(),
  maxFiles: z.number().int().positive().optional(),
  allowTruncation: z.boolean().optional()
});

export const techLeadPlanInputSchema = z.object({
  cwd: z.string().min(1),
  task: z.string().min(1),
  files: z.array(techLeadFileSchema).default([]),
  instructionFiles: z.array(instructionFileSchema).optional(),
  autoLoadInstructions: z.boolean().optional(),
  constraints: z.array(z.string()).optional(),
  knownProblems: z.array(z.string()).optional(),
  previousAttempts: z.array(z.string()).optional(),
  planningMode: z
    .enum([
      "minimal_patch",
      "standard",
      "deep_architectural",
      "migration",
      "debugging",
      "test_repair"
    ])
    .optional(),
  providerPreference: providerPreferenceSchema.optional(),
  contextBudget: contextBudgetSchema.optional(),
  outputPreference: z
    .object({
      includeMarkdown: z.boolean().optional(),
      includeExecutorPrompt: z.boolean().optional(),
      includeRiskMatrix: z.boolean().optional()
    })
    .optional()
});

export const techLeadReviewInputSchema = z.object({
  cwd: z.string().min(1),
  task: z.string().min(1),
  files: z.array(techLeadFileSchema).default([]),
  plan: z.unknown().optional(),
  diff: z.string().optional(),
  changedFiles: z.array(techLeadFileSchema).optional(),
  testResults: z.array(testResultSchema).optional(),
  instructionFiles: z.array(instructionFileSchema).optional(),
  autoLoadInstructions: z.boolean().optional(),
  reviewerFocus: z
    .array(
      z.enum([
        "correctness",
        "plan_adherence",
        "architecture",
        "security",
        "performance",
        "types",
        "tests",
        "edge_cases",
        "maintainability"
      ])
    )
    .optional(),
  providerPreference: providerPreferenceSchema.optional(),
  contextBudget: z
    .object({
      maxInputTokens: z.number().int().positive().optional(),
      maxDiffTokens: z.number().int().positive().optional(),
      maxFileTokens: z.number().int().positive().optional(),
      allowTruncation: z.boolean().optional()
    })
    .optional(),
  outputPreference: z
    .object({
      includeMarkdown: z.boolean().optional(),
      includeFixPrompt: z.boolean().optional(),
      includeApprovalChecklist: z.boolean().optional()
    })
    .optional()
});
