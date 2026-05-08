export function estimateTokens(text: string | undefined): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateFileTokens(files: Array<{ content?: string; summary?: string }>): number {
  return files.reduce((total, file) => total + estimateTokens(file.content ?? file.summary ?? ""), 0);
}
