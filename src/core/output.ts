import type { RouteMetadata } from "../types.js";
import type { TechLeadPlanOutput } from "../server/schemas/outputSchemas.js";
import type { TechLeadReviewOutput } from "../server/schemas/outputSchemas.js";
import type { ModelUsage } from "../providers/types.js";
import type { CostEstimate } from "../telemetry/cost.js";
import { estimateCost } from "../telemetry/cost.js";
import type { TechLeadConfig } from "../config/defaults.js";

export function ensurePlanRoute(output: TechLeadPlanOutput, route: RouteMetadata): TechLeadPlanOutput {
  return {
    ...output,
    schemaVersion: "1.0",
    tool: "techlead.plan",
    route
  };
}

export function ensureReviewRoute(output: TechLeadReviewOutput, route: RouteMetadata): TechLeadReviewOutput {
  return {
    ...output,
    schemaVersion: "1.0",
    tool: "techlead.review",
    route
  };
}

export function toMcpResult(output: Record<string, unknown>) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(output, null, 2)
      }
    ],
    structuredContent: output
  };
}

export function attachUsageAndCost<T extends { markdown?: string; usage?: ModelUsage; cost?: CostEstimate }>(
  output: T,
  usage: ModelUsage | undefined,
  route: RouteMetadata,
  config: TechLeadConfig
): T {
  const price = config.pricing.enabled ? config.pricing.modelPrices[route.model] : undefined;
  const cost = estimateCost(usage, price);
  const usageWithCost =
    usage && cost.totalUsd !== undefined
      ? {
          ...usage,
          costUsd: cost.totalUsd
        }
      : usage;
  const next = {
    ...output,
    usage: usageWithCost,
    cost
  };

  if (next.markdown && cost.totalUsd !== undefined) {
    next.markdown = appendCostToMarkdown(next.markdown, cost.totalUsd, cost.currency);
  }

  return next;
}

function appendCostToMarkdown(markdown: string, totalUsd: number, currency: string): string {
  const line = `Estimated provider cost: ${currency} $${totalUsd.toFixed(6)}`;
  if (markdown.includes("Estimated provider cost:")) return markdown;
  return `${markdown.trim()}\n\n${line}`;
}
