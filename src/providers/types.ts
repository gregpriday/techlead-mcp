import type { JsonSchema, ProviderId, ProviderMessage } from "../types.js";

export type ModelUsage = {
  inputTokens?: number;
  cachedInputTokens?: number;
  cacheCreationInputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  costUsd?: number;
};

export type GenerateStructuredInput = {
  model: string;
  system: string;
  messages: ProviderMessage[];
  schema: JsonSchema;
  schemaName?: string;
  maxOutputTokens?: number;
  effort?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type GenerateStructuredResult<T> = {
  output: T;
  rawText: string;
  usage?: ModelUsage;
  providerMetadata?: Record<string, unknown>;
};

export interface ModelProvider {
  id: ProviderId;
  isAvailable(): boolean;
  generateStructured<T>(input: GenerateStructuredInput): Promise<GenerateStructuredResult<T>>;
}
