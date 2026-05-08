import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ProviderRegistry } from "../providers/index.js";
import { ProviderCallError, ProviderOutputParseError, ProviderUnavailableError } from "../providers/errors.js";
import type { ModelProvider } from "../providers/types.js";
import type { ModelUsage } from "../providers/types.js";
import type { ProviderId, ProviderMessage, RouteMetadata } from "../types.js";
import { mergeUsage } from "../telemetry/cost.js";

export type StructuredModelCallInput<TSchema extends z.ZodTypeAny> = {
  providers: ProviderRegistry;
  route: RouteMetadata & {
    fallbackProviders?: ProviderId[];
    fallbackModels?: Partial<Record<ProviderId, string>>;
  };
  schema: TSchema;
  schemaName: string;
  system: string;
  messages: ProviderMessage[];
  maxOutputTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
};

export type StructuredModelCallResult<T> = {
  output: T;
  rawText: string;
  route: RouteMetadata;
  usage?: ModelUsage;
  attempts: Array<{ provider: ProviderId; model: string; error?: string }>;
};

export async function callStructuredModel<TSchema extends z.ZodTypeAny>(
  input: StructuredModelCallInput<TSchema>
): Promise<StructuredModelCallResult<z.infer<TSchema>>> {
  const attempts: Array<{ provider: ProviderId; model: string; error?: string }> = [];
  const providerOrder = [input.route.provider, ...(input.route.fallbackProviders ?? [])];
  let lastError: unknown;

  for (const providerId of providerOrder) {
    const provider = input.providers[providerId];
    if (!provider?.isAvailable()) {
      attempts.push({ provider: providerId, model: input.route.model, error: "provider unavailable" });
      continue;
    }

    const model = providerId === input.route.provider ? input.route.model : input.route.fallbackModels?.[providerId];
    if (!model) {
      attempts.push({ provider: providerId, model: input.route.model, error: "missing fallback model" });
      continue;
    }
    const route: RouteMetadata = {
      provider: providerId,
      model,
      modelTier: input.route.modelTier,
      effort: input.route.effort,
      routingReason:
        providerId === input.route.provider
          ? input.route.routingReason
          : `${input.route.routingReason}; fell back to ${providerId}`
    };

    try {
      const result = await attemptWithRepair(provider, {
        ...input,
        route,
        model
      });
      attempts.push({ provider: providerId, model });
      return { ...result, route, attempts };
    } catch (error) {
      lastError = error;
      attempts.push({ provider: providerId, model, error: (error as Error).message });
      if (!(error instanceof ProviderUnavailableError || error instanceof ProviderCallError || error instanceof ProviderOutputParseError)) {
        break;
      }
    }
  }

  throw new Error(`Structured model call failed: ${(lastError as Error | undefined)?.message ?? "unknown error"}`);
}

async function attemptWithRepair<TSchema extends z.ZodTypeAny>(
  provider: ModelProvider,
  input: StructuredModelCallInput<TSchema> & { route: RouteMetadata; model: string }
): Promise<Omit<StructuredModelCallResult<z.infer<TSchema>>, "route" | "attempts">> {
  const jsonSchema = zodToJsonSchema(input.schema, input.schemaName) as Record<string, unknown>;
  const first = await provider.generateStructured<unknown>({
    model: input.model,
    system: input.system,
    messages: input.messages,
    schema: jsonSchema,
    schemaName: input.schemaName,
    maxOutputTokens: input.maxOutputTokens,
    effort: input.route.effort,
    timeoutMs: input.timeoutMs,
    signal: input.signal
  });

  const parsed = input.schema.safeParse(first.output);
  if (parsed.success) return { output: parsed.data, rawText: first.rawText, usage: first.usage };

  const repair = await provider.generateStructured<unknown>({
    model: input.model,
    system: `${input.system}

The previous response failed schema validation. Return corrected JSON only. Do not add prose.`,
    messages: [
      ...input.messages,
      {
        role: "assistant",
        content: first.rawText
      },
      {
        role: "user",
        content: `Validation error:\n${parsed.error.message}\n\nReturn corrected JSON matching the required schema exactly.`
      }
    ],
    schema: jsonSchema,
    schemaName: input.schemaName,
    maxOutputTokens: input.maxOutputTokens,
    effort: input.route.effort,
    timeoutMs: input.timeoutMs,
    signal: input.signal
  });

  const repairedParsed = input.schema.safeParse(repair.output);
  if (!repairedParsed.success) {
    throw new ProviderOutputParseError(
      provider.id,
      `Provider output failed schema validation after repair: ${repairedParsed.error.message}`,
      repair.rawText
    );
  }

  return {
    output: repairedParsed.data,
    rawText: repair.rawText,
    usage: mergeUsage(first.usage, repair.usage)
  };
}
