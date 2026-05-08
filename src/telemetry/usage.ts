import type { ModelUsage } from "../providers/types.js";

export type UsageRecord = ModelUsage & {
  provider: string;
  model: string;
  tool: string;
  at: string;
};

export function createUsageRecord(input: Omit<UsageRecord, "at">): UsageRecord {
  return { ...input, at: new Date().toISOString() };
}
