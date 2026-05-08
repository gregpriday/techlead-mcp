import type { ProviderPreference, ToolKind } from "../types.js";

export type DeterministicRouteInput = {
  tool: ToolKind;
  task: string;
  fileCount: number;
  totalInputTokensEstimate: number;
  diffTokensEstimate?: number;
  planningMode?: string;
  reviewerFocus?: string[];
  testStatuses?: string[];
  previousAttempts?: string[];
  providerPreference?: ProviderPreference;
};

export type RiskAssessment = {
  riskSignals: string[];
  modelTier: "balanced" | "max";
  effort: "medium" | "high" | "xhigh" | "max";
  reason: string;
};

const highRiskTerms = [
  "auth",
  "authentication",
  "authorization",
  "permission",
  "payments",
  "billing",
  "invoice",
  "security",
  "secret",
  "crypto",
  "migration",
  "migrate",
  "schema",
  "delete",
  "data loss",
  "concurrency",
  "race condition",
  "distributed",
  "consistency",
  "public api",
  "breaking change"
];

export function assessRisk(input: DeterministicRouteInput): RiskAssessment {
  const signals: string[] = [];
  const task = input.task.toLowerCase();

  for (const term of highRiskTerms) {
    if (task.includes(term)) signals.push(`task mentions ${term}`);
  }

  if (input.fileCount > 8) signals.push(`many important files (${input.fileCount})`);
  if ((input.diffTokensEstimate ?? 0) > 25_000) signals.push("large diff");
  if ((input.totalInputTokensEstimate ?? 0) > 150_000) signals.push("large context");
  if (input.planningMode === "deep_architectural") signals.push("deep architectural planning mode");
  if (input.planningMode === "migration") signals.push("migration planning mode");
  if (input.testStatuses?.includes("failed")) signals.push("failing tests provided");
  if (input.previousAttempts?.length) signals.push("previous attempt exists");
  if (input.reviewerFocus?.some(focus => focus === "security" || focus === "architecture")) {
    signals.push("review focus includes high-risk area");
  }

  const preferenceTier = input.providerPreference?.modelTier;
  if (preferenceTier === "max") signals.push("caller requested max tier");

  const modelTier = signals.length > 0 ? "max" : "balanced";
  const effort = modelTier === "max" ? "high" : "medium";
  const reason =
    signals.length > 0
      ? `Escalated to max due to: ${signals.join("; ")}`
      : "Balanced tier is sufficient for localized, lower-risk work";

  return { riskSignals: signals, modelTier, effort, reason };
}
