import { z } from "zod";
import type { TechLeadConfig } from "../config/defaults.js";
import type { ProviderRegistry } from "../providers/index.js";
import type { ProviderPreference, ToolKind } from "../types.js";
import { routerSystemPrompt } from "../prompts/router.js";
import { zodToJsonSchema } from "zod-to-json-schema";

export const routerOutputSchema = z.object({
  provider: z.enum(["openai", "anthropic", "gemini"]),
  modelTier: z.enum(["balanced", "max"]),
  effort: z.enum(["medium", "high", "xhigh", "max"]),
  reason: z.string(),
  confidence: z.number().min(0).max(1)
});

export type RouterOutput = z.infer<typeof routerOutputSchema>;

export type RouterLlmInput = {
  tool: ToolKind;
  task: string;
  fileCount: number;
  totalInputTokensEstimate: number;
  diffTokensEstimate?: number;
  planningMode?: string;
  reviewerFocus?: string[];
  riskSignals: string[];
  providerPreference?: ProviderPreference;
};

export async function runOptionalLlmRouter(
  input: RouterLlmInput,
  config: TechLeadConfig,
  providers: ProviderRegistry,
  signal?: AbortSignal
): Promise<RouterOutput | undefined> {
  if (!config.routing.optionalLlmRouter) return undefined;
  const provider = providers[config.routing.routerProvider];
  if (!provider?.isAvailable()) return undefined;

  const model = config.models[config.routing.routerProvider].router;
  const result = await provider.generateStructured<unknown>({
    model,
    system: routerSystemPrompt,
    messages: [{ role: "user", content: JSON.stringify(input, null, 2) }],
    schema: zodToJsonSchema(routerOutputSchema, "routerOutput") as Record<string, unknown>,
    schemaName: "techlead_router_output",
    maxOutputTokens: 1024,
    effort: "low",
    timeoutMs: 10_000,
    signal
  });

  return routerOutputSchema.parse(result.output);
}
