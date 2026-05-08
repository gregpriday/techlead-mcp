import type { ModelUsage } from "../providers/types.js";

export type TokenPrice = {
  inputPerMillion: number;
  outputPerMillion: number;
};

export function estimateCostUsd(
  usage: ModelUsage | undefined,
  price: TokenPrice | undefined
): number | undefined {
  if (!usage || !price) return undefined;
  const input = ((usage.inputTokens ?? 0) / 1_000_000) * price.inputPerMillion;
  const output = ((usage.outputTokens ?? 0) / 1_000_000) * price.outputPerMillion;
  return Number((input + output).toFixed(6));
}
