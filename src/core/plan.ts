import type { TechLeadConfig } from "../config/defaults.js";
import { packContext } from "../context/packContext.js";
import { estimateTokens } from "../context/estimateTokens.js";
import { baseSystemPrompt } from "../prompts/base.js";
import { planSystemPrompt } from "../prompts/plan.js";
import { resolveGitHubIssueTask } from "../github/issues.js";
import type { ProviderRegistry } from "../providers/index.js";
import { routeModel } from "../router/route.js";
import { techLeadPlanInputSchema } from "../server/schemas/inputSchemas.js";
import {
  techLeadPlanOutputSchema,
  type TechLeadPlanOutput
} from "../server/schemas/outputSchemas.js";
import type { TechLeadPlanInput } from "../types.js";
import { callStructuredModel } from "./modelCall.js";
import { attachUsageAndCost, contextSummaryFromDossier, ensurePlanRoute } from "./output.js";

export type PlanOptions = {
  config: TechLeadConfig;
  providers: ProviderRegistry;
  allowLocalFiles?: boolean;
  signal?: AbortSignal;
};

export async function plan(input: TechLeadPlanInput, options: PlanOptions): Promise<TechLeadPlanOutput> {
  const parsed = techLeadPlanInputSchema.parse(input);
  const task = parsed.task ?? (await resolveGitHubIssueTask(parsed.githubIssue!, options.config));
  const dossier = await packContext({ ...parsed, task }, options.config, options.allowLocalFiles ?? true);
  const route = routeModel(
    {
      tool: "plan",
      task,
      fileCount: dossier.files.length,
      totalInputTokensEstimate: dossier.estimatedTokens,
      planningMode: parsed.planningMode,
      previousAttempts: parsed.previousAttempts,
      providerPreference: parsed.providerPreference
    },
    options.config,
    options.providers
  );

  const includeMarkdown = parsed.outputPreference?.includeMarkdown ?? true;
  const includeExecutorPrompt = parsed.outputPreference?.includeExecutorPrompt ?? true;
  const includeRiskMatrix = parsed.outputPreference?.includeRiskMatrix ?? false;

  const result = await callStructuredModel({
    providers: options.providers,
    route,
    schema: techLeadPlanOutputSchema,
    schemaName: "techlead_plan_output",
    system: `${baseSystemPrompt}

${planSystemPrompt}`,
    messages: [
      {
        role: "user",
        content: `Create a structured implementation plan for the task below.

Output preferences:
- includeMarkdown: ${includeMarkdown}
- includeExecutorPrompt: ${includeExecutorPrompt}
- includeRiskMatrix: ${includeRiskMatrix}

Context dossier:
${dossier.text}`
      }
    ],
    maxOutputTokens: route.modelTier === "max" ? 16_384 : 10_000,
    timeoutMs: route.modelTier === "max" ? 180_000 : 90_000,
    signal: options.signal
  });

  const output = attachUsageAndCost(ensurePlanRoute(result.output, result.route), result.usage, result.route, options.config);
  output.contextSummary = contextSummaryFromDossier(dossier);
  if (!includeMarkdown) delete output.markdown;
  if (!includeExecutorPrompt) delete output.handoffPromptForExecutor;
  return output;
}

export function estimatePlanInputTokens(input: TechLeadPlanInput): number {
  return estimateTokens(JSON.stringify(input));
}
