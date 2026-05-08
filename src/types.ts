import type { z } from "zod";
import type {
  instructionFileSchema,
  providerPreferenceSchema,
  githubIssueReferenceSchema,
  techLeadFileSchema,
  techLeadPlanInputSchema,
  techLeadReviewInputSchema,
  testResultSchema
} from "./server/schemas/inputSchemas.js";
import type {
  techLeadPlanOutputSchema,
  techLeadReviewOutputSchema
} from "./server/schemas/outputSchemas.js";

export type JsonObject = Record<string, unknown>;
export type JsonSchema = JsonObject;

export type TechLeadFile = z.infer<typeof techLeadFileSchema>;
export type InstructionFile = z.infer<typeof instructionFileSchema>;
export type TestResult = z.infer<typeof testResultSchema>;
export type ProviderPreference = z.infer<typeof providerPreferenceSchema>;
export type GitHubIssueReference = z.infer<typeof githubIssueReferenceSchema>;

export type TechLeadPlanInput = z.infer<typeof techLeadPlanInputSchema>;
export type TechLeadReviewInput = z.infer<typeof techLeadReviewInputSchema>;

export type TechLeadPlanOutput = z.infer<typeof techLeadPlanOutputSchema>;
export type TechLeadReviewOutput = z.infer<typeof techLeadReviewOutputSchema>;

export type ProviderId = "openai" | "anthropic" | "gemini";
export type ModelTier = "balanced" | "max";
export type ToolKind = "plan" | "review";

export type RouteMetadata = {
  provider: ProviderId;
  model: string;
  modelTier: ModelTier;
  effort: string;
  routingReason: string;
};

export type ProviderMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ContextDossier = {
  cwd: string;
  localMode: boolean;
  text: string;
  files: TechLeadFile[];
  changedFiles: TechLeadFile[];
  instructionFiles: InstructionFile[];
  estimatedTokens: number;
  contextSummary?: {
    localMode: boolean;
    estimatedTokens: number;
    fileCount: number;
    changedFileCount?: number;
    instructionFileCount: number;
    missingFiles: string[];
    warnings: string[];
    truncated: Array<{ path: string; originalTokens: number; keptTokens: number }>;
    redactions: Array<{ type: string; count: number }>;
  };
  redactions: Array<{ type: string; count: number }>;
  truncated: Array<{ path: string; originalTokens: number; keptTokens: number }>;
  missingFiles: string[];
  warnings: string[];
};
