import type { ModelUsage } from "../providers/types.js";

export type TokenPrice = {
  inputPerMillion: number;
  outputPerMillion: number;
  cachedInputPerMillion?: number;
  cacheCreationInputPerMillion?: number;
  longContextThresholdTokens?: number;
  longInputPerMillion?: number;
  longOutputPerMillion?: number;
  source?: string;
};

export type CostEstimate = {
  currency: "USD";
  totalUsd?: number;
  inputUsd?: number;
  cachedInputUsd?: number;
  cacheCreationInputUsd?: number;
  outputUsd?: number;
  inputPerMillion?: number;
  cachedInputPerMillion?: number;
  cacheCreationInputPerMillion?: number;
  outputPerMillion?: number;
  pricingSource: "configured" | "unavailable";
  note: string;
};

export function estimateCostUsd(usage: ModelUsage | undefined, price: TokenPrice | undefined): number | undefined {
  return estimateCost(usage, price).totalUsd;
}

export function estimateCost(usage: ModelUsage | undefined, price: TokenPrice | undefined): CostEstimate {
  if (!usage || !price) {
    return {
      currency: "USD",
      pricingSource: "unavailable",
      note: "Provider returned no usage metadata or no configured price was found for this model."
    };
  }

  const inputTokens = usage.inputTokens ?? 0;
  const cachedTokens = usage.cachedInputTokens ?? 0;
  const cacheCreationTokens = usage.cacheCreationInputTokens ?? 0;
  const standardInputTokens = Math.max(0, inputTokens - cachedTokens - cacheCreationTokens);
  const useLongContext =
    Boolean(price.longContextThresholdTokens) && inputTokens > (price.longContextThresholdTokens ?? Number.MAX_SAFE_INTEGER);
  const inputPerMillion = useLongContext ? price.longInputPerMillion ?? price.inputPerMillion : price.inputPerMillion;
  const outputPerMillion = useLongContext ? price.longOutputPerMillion ?? price.outputPerMillion : price.outputPerMillion;
  const cachedInputPerMillion = price.cachedInputPerMillion ?? inputPerMillion;
  const cacheCreationInputPerMillion = price.cacheCreationInputPerMillion ?? inputPerMillion;

  const inputUsd = (standardInputTokens / 1_000_000) * inputPerMillion;
  const cachedInputUsd = (cachedTokens / 1_000_000) * cachedInputPerMillion;
  const cacheCreationInputUsd = (cacheCreationTokens / 1_000_000) * cacheCreationInputPerMillion;
  const outputUsd = ((usage.outputTokens ?? 0) / 1_000_000) * outputPerMillion;
  const totalUsd = inputUsd + cachedInputUsd + cacheCreationInputUsd + outputUsd;

  return {
    currency: "USD",
    totalUsd: roundUsd(totalUsd),
    inputUsd: roundUsd(inputUsd),
    cachedInputUsd: cachedTokens ? roundUsd(cachedInputUsd) : undefined,
    cacheCreationInputUsd: cacheCreationTokens ? roundUsd(cacheCreationInputUsd) : undefined,
    outputUsd: roundUsd(outputUsd),
    inputPerMillion,
    cachedInputPerMillion: price.cachedInputPerMillion,
    cacheCreationInputPerMillion: price.cacheCreationInputPerMillion,
    outputPerMillion,
    pricingSource: "configured",
    note: price.source ?? "Estimated from configured per-million token prices; provider billing dashboards remain authoritative."
  };
}

export function mergeUsage(...items: Array<ModelUsage | undefined>): ModelUsage | undefined {
  const defined = items.filter(Boolean) as ModelUsage[];
  if (defined.length === 0) return undefined;

  return {
    inputTokens: sum(defined, "inputTokens"),
    cachedInputTokens: sum(defined, "cachedInputTokens"),
    cacheCreationInputTokens: sum(defined, "cacheCreationInputTokens"),
    outputTokens: sum(defined, "outputTokens"),
    reasoningTokens: sum(defined, "reasoningTokens"),
    totalTokens: sum(defined, "totalTokens"),
    costUsd: sum(defined, "costUsd")
  };
}

function sum(items: ModelUsage[], key: keyof ModelUsage): number | undefined {
  const values = items.map(item => item[key]).filter((value): value is number => typeof value === "number");
  if (values.length === 0) return undefined;
  return values.reduce((total, value) => total + value, 0);
}

function roundUsd(value: number): number {
  return Number(value.toFixed(8));
}
