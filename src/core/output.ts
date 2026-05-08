import type { RouteMetadata } from "../types.js";
import type { TechLeadPlanOutput } from "../server/schemas/outputSchemas.js";
import type { TechLeadReviewOutput } from "../server/schemas/outputSchemas.js";

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
