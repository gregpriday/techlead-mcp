import type { TechLeadFile } from "../types.js";

const importanceWeight = {
  critical: 100,
  high: 70,
  medium: 40,
  low: 10
} as const;

const kindWeight = {
  diff: 95,
  instructions: 90,
  test: 80,
  source: 70,
  config: 55,
  docs: 35,
  log: 30,
  unknown: 20
} as const;

export function rankFiles(files: TechLeadFile[]): TechLeadFile[] {
  return [...files].sort((a, b) => scoreFile(b) - scoreFile(a) || a.path.localeCompare(b.path));
}

function scoreFile(file: TechLeadFile): number {
  const importance = file.importance ? importanceWeight[file.importance] : 35;
  const kind = file.kind ? kindWeight[file.kind] : 20;
  const reason = file.reason ? 8 : 0;
  const summary = file.summary && !file.content ? 4 : 0;
  return importance + kind + reason + summary;
}
