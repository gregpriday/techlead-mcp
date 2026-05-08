import OpenAI from "openai";
import { ProviderCallError, ProviderOutputParseError, ProviderUnavailableError } from "./errors.js";
import { joinProviderMessages, parseJsonObject } from "./json.js";
import type { GenerateStructuredInput, GenerateStructuredResult, ModelProvider } from "./types.js";

export type OpenAIProviderOptions = {
  apiKey?: string;
  client?: OpenAI;
};

export function createOpenAIProvider(options: OpenAIProviderOptions = {}): ModelProvider {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const client = options.client ?? (apiKey ? new OpenAI({ apiKey }) : undefined);

  return {
    id: "openai",
    isAvailable: () => Boolean(client),
    async generateStructured<T>(input: GenerateStructuredInput): Promise<GenerateStructuredResult<T>> {
      if (!client) {
        throw new ProviderUnavailableError("openai", "OPENAI_API_KEY is not configured");
      }

      try {
        const response = await client.responses.create(
          {
            model: input.model as never,
            instructions: input.system,
            input: joinProviderMessages(input.messages),
            max_output_tokens: input.maxOutputTokens ?? 8192,
            reasoning: openAIReasoning(input.effort),
            store: false,
            text: {
              format: {
                type: "json_schema",
                name: input.schemaName ?? "techlead_output",
                schema: input.schema,
                strict: false
              }
            }
          },
          { signal: input.signal, timeout: input.timeoutMs } as never
        );

        const rawText = response.output_text ?? "";
        return {
          output: parseJsonObject<T>("openai", rawText),
          rawText,
          usage: response.usage
            ? {
                inputTokens: response.usage.input_tokens,
                cachedInputTokens: response.usage.input_tokens_details?.cached_tokens,
                outputTokens: response.usage.output_tokens,
                reasoningTokens: response.usage.output_tokens_details?.reasoning_tokens,
                totalTokens: response.usage.total_tokens
              }
            : undefined,
          providerMetadata: { responseId: response.id, model: response.model }
        };
      } catch (error) {
        if (error instanceof ProviderUnavailableError || error instanceof ProviderOutputParseError) throw error;
        throw new ProviderCallError("openai", `OpenAI request failed: ${(error as Error).message}`, error);
      }
    }
  };
}

function openAIReasoning(effort: string | undefined): { effort?: "low" | "medium" | "high" | null } | undefined {
  if (effort === "low" || effort === "medium" || effort === "high") return { effort };
  if (effort === "xhigh" || effort === "max") return { effort: "high" };
  return undefined;
}
