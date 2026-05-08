import type { TechLeadConfig } from "../config/defaults.js";
import { packContext } from "../context/packContext.js";
import { estimateTokens } from "../context/estimateTokens.js";
import { baseSystemPrompt } from "../prompts/base.js";
import { reviewSystemPrompt } from "../prompts/review.js";
import type { ProviderRegistry } from "../providers/index.js";
import { routeModel } from "../router/route.js";
import { techLeadReviewInputSchema } from "../server/schemas/inputSchemas.js";
import {
  techLeadReviewOutputSchema,
  type TechLeadReviewOutput
} from "../server/schemas/outputSchemas.js";
import type { TechLeadReviewInput } from "../types.js";
import { callStructuredModel } from "./modelCall.js";
import { attachUsageAndCost, ensureReviewRoute } from "./output.js";

export type ReviewOptions = {
  config: TechLeadConfig;
  providers: ProviderRegistry;
  allowLocalFiles?: boolean;
  signal?: AbortSignal;
};

export async function review(input: TechLeadReviewInput, options: ReviewOptions): Promise<TechLeadReviewOutput> {
  const parsed = techLeadReviewInputSchema.parse(input);
  const dossier = await packContext(
    {
      cwd: parsed.cwd,
      task: parsed.task,
      files: parsed.files,
      changedFiles: parsed.changedFiles,
      instructionFiles: parsed.instructionFiles,
      autoLoadInstructions: parsed.autoLoadInstructions,
      reviewerFocus: parsed.reviewerFocus,
      diff: parsed.diff,
      plan: parsed.plan,
      testResults: parsed.testResults,
      contextBudget: parsed.contextBudget
    },
    options.config,
    options.allowLocalFiles ?? true
  );

  const route = routeModel(
    {
      tool: "review",
      task: parsed.task,
      fileCount: dossier.files.length,
      totalInputTokensEstimate: dossier.estimatedTokens,
      diffTokensEstimate: estimateTokens(parsed.diff),
      reviewerFocus: parsed.reviewerFocus,
      testStatuses: parsed.testResults?.map(result => result.status),
      providerPreference: parsed.providerPreference
    },
    options.config,
    options.providers
  );

  const includeMarkdown = parsed.outputPreference?.includeMarkdown ?? true;
  const includeFixPrompt = parsed.outputPreference?.includeFixPrompt ?? true;
  const includeApprovalChecklist = parsed.outputPreference?.includeApprovalChecklist ?? true;

  const result = await callStructuredModel({
    providers: options.providers,
    route,
    schema: techLeadReviewOutputSchema,
    schemaName: "techlead_review_output",
    system: `${baseSystemPrompt}

${reviewSystemPrompt}`,
    messages: [
      {
        role: "user",
        content: `Review the proposed implementation for the task below.

Output preferences:
- includeMarkdown: ${includeMarkdown}
- includeFixPrompt: ${includeFixPrompt}
- includeApprovalChecklist: ${includeApprovalChecklist}

Review evidence notes:
- diff provided: ${Boolean(parsed.diff)}
- changedFiles provided: ${Boolean(parsed.changedFiles?.length)}
- testResults provided: ${Boolean(parsed.testResults?.length)}

Context dossier:
${dossier.text}`
      }
    ],
    maxOutputTokens: route.modelTier === "max" ? 16_384 : 10_000,
    timeoutMs: route.modelTier === "max" ? 180_000 : 90_000,
    signal: options.signal
  });

  const output = attachUsageAndCost(ensureReviewRoute(result.output, result.route), result.usage, result.route, options.config);
  if (!includeMarkdown) delete output.markdown;
  if (!includeFixPrompt) delete output.fixPromptForExecutor;
  if (!includeApprovalChecklist) output.approvalChecklist = [];
  return output;
}

export function estimateReviewInputTokens(input: TechLeadReviewInput): number {
  return estimateTokens(JSON.stringify(input));
}
