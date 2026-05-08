import { GoogleGenAI } from "@google/genai";
import { ProviderCallError, ProviderOutputParseError, ProviderUnavailableError } from "./errors.js";
import { joinProviderMessages, parseJsonObject } from "./json.js";
import type { GenerateStructuredInput, GenerateStructuredResult, ModelProvider } from "./types.js";

export type GeminiProviderOptions = {
  apiKey?: string;
  client?: GoogleGenAI;
};

export function createGeminiProvider(options: GeminiProviderOptions = {}): ModelProvider {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const client = options.client ?? (apiKey ? new GoogleGenAI({ apiKey }) : undefined);

  return {
    id: "gemini",
    isAvailable: () => Boolean(client),
    async generateStructured<T>(input: GenerateStructuredInput): Promise<GenerateStructuredResult<T>> {
      if (!client) {
        throw new ProviderUnavailableError("gemini", "GEMINI_API_KEY or GOOGLE_API_KEY is not configured");
      }

      try {
        const response = await client.models.generateContent({
          model: input.model,
          contents: joinProviderMessages(input.messages),
          config: {
            systemInstruction: input.system,
            maxOutputTokens: input.maxOutputTokens,
            responseMimeType: "application/json",
            responseJsonSchema: input.schema,
            abortSignal: input.signal
          }
        });

        const rawText = response.text ?? "";
        return {
          output: parseJsonObject<T>("gemini", rawText),
          rawText,
          usage: response.usageMetadata
            ? {
                inputTokens: response.usageMetadata.promptTokenCount,
                cachedInputTokens: response.usageMetadata.cachedContentTokenCount,
                outputTokens: response.usageMetadata.candidatesTokenCount,
                reasoningTokens: response.usageMetadata.thoughtsTokenCount,
                totalTokens: response.usageMetadata.totalTokenCount
              }
            : undefined,
          providerMetadata: { responseId: response.responseId, modelVersion: response.modelVersion }
        };
      } catch (error) {
        if (error instanceof ProviderUnavailableError || error instanceof ProviderOutputParseError) throw error;
        throw new ProviderCallError("gemini", `Gemini request failed: ${(error as Error).message}`, error);
      }
    }
  };
}
