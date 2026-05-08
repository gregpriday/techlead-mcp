import { estimateTokens } from "./estimateTokens.js";

export type TruncationRecord = {
  path: string;
  originalTokens: number;
  keptTokens: number;
};

export function truncateToTokenBudget(
  text: string,
  maxTokens: number,
  marker = "\n[...truncated by TechLead MCP...]\n"
): { text: string; originalTokens: number; keptTokens: number; truncated: boolean } {
  const originalTokens = estimateTokens(text);
  if (originalTokens <= maxTokens) {
    return { text, originalTokens, keptTokens: originalTokens, truncated: false };
  }

  const maxChars = Math.max(0, maxTokens * 4 - marker.length);
  if (maxChars <= 0) {
    return { text: marker.trim(), originalTokens, keptTokens: estimateTokens(marker), truncated: true };
  }

  const headChars = Math.ceil(maxChars * 0.65);
  const tailChars = Math.floor(maxChars * 0.35);
  const truncatedText = `${text.slice(0, headChars)}${marker}${text.slice(Math.max(headChars, text.length - tailChars))}`;

  return {
    text: truncatedText,
    originalTokens,
    keptTokens: estimateTokens(truncatedText),
    truncated: true
  };
}
