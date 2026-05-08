import Anthropic from "@anthropic-ai/sdk";
import { ProviderCallError, ProviderOutputParseError, ProviderUnavailableError } from "./errors.js";
import { parseJsonObject } from "./json.js";
import type { GenerateStructuredInput, GenerateStructuredResult, ModelProvider } from "./types.js";

export type AnthropicProviderOptions = {
  apiKey?: string;
  client?: Anthropic;
};

export function createAnthropicProvider(options: AnthropicProviderOptions = {}): ModelProvider {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const client = options.client ?? (apiKey ? new Anthropic({ apiKey }) : undefined);

  return {
    id: "anthropic",
    isAvailable: () => Boolean(client),
    async generateStructured<T>(input: GenerateStructuredInput): Promise<GenerateStructuredResult<T>> {
      if (!client) {
        throw new ProviderUnavailableError("anthropic", "ANTHROPIC_API_KEY is not configured");
      }

      try {
        const response = await client.messages.create(
          {
            model: input.model,
            max_tokens: input.maxOutputTokens ?? 8192,
            system: input.system,
            messages: input.messages.map(message => ({
              role: message.role,
              content: message.content
            })),
            output_config: {
              effort: normalizeAnthropicEffort(input.effort),
              format: {
                type: "json_schema",
                schema: input.schema
              }
            }
          },
          { signal: input.signal, timeout: input.timeoutMs } as never
        );

        const rawText = response.content
          .filter(block => block.type === "text")
          .map(block => block.text)
          .join("");

        return {
          output: parseJsonObject<T>("anthropic", rawText),
          rawText,
          usage: {
            inputTokens:
              response.usage.input_tokens +
              (response.usage.cache_creation_input_tokens ?? 0) +
              (response.usage.cache_read_input_tokens ?? 0),
            outputTokens: response.usage.output_tokens,
            totalTokens:
              response.usage.input_tokens +
              response.usage.output_tokens +
              (response.usage.cache_creation_input_tokens ?? 0) +
              (response.usage.cache_read_input_tokens ?? 0)
          },
          providerMetadata: { id: response.id, model: response.model, stopReason: response.stop_reason }
        };
      } catch (error) {
        if (error instanceof ProviderUnavailableError || error instanceof ProviderOutputParseError) throw error;
        throw new ProviderCallError("anthropic", `Anthropic request failed: ${(error as Error).message}`, error);
      }
    }
  };
}

function normalizeAnthropicEffort(
  effort: string | undefined
): "low" | "medium" | "high" | "xhigh" | "max" | null | undefined {
  if (effort === "low" || effort === "medium" || effort === "high" || effort === "xhigh" || effort === "max") {
    return effort;
  }
  return undefined;
}
