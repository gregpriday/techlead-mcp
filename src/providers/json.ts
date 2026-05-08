import { ProviderOutputParseError } from "./errors.js";
import type { ProviderId } from "../types.js";

export function parseJsonObject<T>(provider: ProviderId, rawText: string): T {
  const normalized = stripMarkdownFence(rawText.trim());
  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Model output was not a JSON object");
    }
    return parsed as T;
  } catch (error) {
    throw new ProviderOutputParseError(
      provider,
      `Could not parse structured JSON output: ${(error as Error).message}`,
      rawText
    );
  }
}

export function stripMarkdownFence(text: string): string {
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  return match ? match[1]!.trim() : text;
}

export function joinProviderMessages(messages: Array<{ role: string; content: string }>): string {
  return messages.map(message => `<${message.role}>\n${message.content}\n</${message.role}>`).join("\n\n");
}
