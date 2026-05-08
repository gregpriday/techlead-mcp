import type { TechLeadConfig } from "../config/defaults.js";
import type { ContextDossier, InstructionFile, TechLeadFile, TestResult } from "../types.js";
import { buildDossier } from "./buildDossier.js";
import { estimateFileTokens, estimateTokens } from "./estimateTokens.js";
import { loadAutoFiles } from "./loadAutoFiles.js";
import { normalizeFiles } from "./normalizeFiles.js";
import { rankFiles } from "./rankFiles.js";
import { mergeRedactions, redactSecrets, type RedactionSummary } from "./redactSecrets.js";
import { truncateToTokenBudget, type TruncationRecord } from "./truncate.js";

export type PackContextInput = {
  cwd: string;
  task: string;
  files: TechLeadFile[];
  instructionFiles?: InstructionFile[];
  autoLoadInstructions?: boolean;
  constraints?: string[];
  knownProblems?: string[];
  previousAttempts?: string[];
  planningMode?: string;
  reviewerFocus?: string[];
  diff?: string;
  plan?: unknown;
  changedFiles?: TechLeadFile[];
  testResults?: TestResult[];
  contextBudget?: {
    maxInputTokens?: number;
    maxFileTokens?: number;
    maxFiles?: number;
    maxDiffTokens?: number;
    allowTruncation?: boolean;
  };
};

export async function packContext(
  input: PackContextInput,
  config: TechLeadConfig,
  allowLocalFiles: boolean
): Promise<ContextDossier> {
  const normalized = await normalizeFiles({
    cwd: input.cwd,
    files: [...input.files, ...(input.changedFiles ?? [])],
    allowLocalFiles,
    config
  });

  const shouldAutoLoad = input.autoLoadInstructions ?? config.context.autoLoadInstructions;
  const auto = shouldAutoLoad
    ? await loadAutoFiles(normalized.cwd, config, allowLocalFiles && normalized.localMode)
    : { instructionFiles: [], projectFiles: [], warnings: [] };

  const instructionFiles = dedupeInstructions([
    ...(input.instructionFiles ?? []).map(file => ({ ...file, source: "caller_supplied" as const })),
    ...auto.instructionFiles
  ]);

  let files = rankFiles(dedupeFiles([...normalized.files, ...auto.projectFiles]));
  const maxFiles = input.contextBudget?.maxFiles ?? config.context.maxFiles;
  if (files.length > maxFiles) files = files.slice(0, maxFiles);

  const maxFileTokens = input.contextBudget?.maxFileTokens ?? config.context.maxFileTokens;
  const allowTruncation = input.contextBudget?.allowTruncation ?? config.context.allowTruncation;
  const redactionSummaries: RedactionSummary[] = [];
  const truncated: TruncationRecord[] = [];

  files = files.map(file => {
    let content = file.content;
    if (content !== undefined && config.security.redactSecrets) {
      const redacted = redactSecrets(content);
      content = redacted.text;
      redactionSummaries.push(redacted.redactions);
    }
    if (content !== undefined && allowTruncation) {
      const result = truncateToTokenBudget(content, maxFileTokens);
      content = result.text;
      if (result.truncated) {
        truncated.push({
          path: file.path,
          originalTokens: result.originalTokens,
          keptTokens: result.keptTokens
        });
      }
    }
    return { ...file, content };
  });

  const redactedInstructions = instructionFiles.map(file => {
    if (!config.security.redactSecrets) return file;
    const redacted = redactSecrets(file.content);
    redactionSummaries.push(redacted.redactions);
    return { ...file, content: redacted.text };
  });

  let diff = input.diff;
  if (diff && config.security.redactSecrets) {
    const redacted = redactSecrets(diff);
    diff = redacted.text;
    redactionSummaries.push(redacted.redactions);
  }
  const maxDiffTokens = input.contextBudget?.maxDiffTokens ?? Math.min(config.context.maxFileTokens, 80_000);
  if (diff && allowTruncation) {
    const result = truncateToTokenBudget(diff, maxDiffTokens);
    diff = result.text;
    if (result.truncated) {
      truncated.push({ path: "[diff]", originalTokens: result.originalTokens, keptTokens: result.keptTokens });
    }
  }

  let dossier = buildDossier({
    cwd: normalized.localMode ? "." : normalized.cwd,
    task: input.task,
    constraints: input.constraints,
    knownProblems: input.knownProblems,
    previousAttempts: input.previousAttempts,
    planningMode: input.planningMode,
    reviewerFocus: input.reviewerFocus,
    instructionFiles: redactedInstructions,
    files,
    diff,
    plan: input.plan,
    testResults: input.testResults,
    warnings: [...normalized.warnings, ...auto.warnings]
  });

  const maxInputTokens = input.contextBudget?.maxInputTokens ?? config.context.maxInputTokens;
  if (allowTruncation && estimateTokens(dossier) > maxInputTokens) {
    const result = truncateToTokenBudget(dossier, maxInputTokens);
    dossier = result.text;
    truncated.push({ path: "[dossier]", originalTokens: result.originalTokens, keptTokens: result.keptTokens });
  }

  return {
    cwd: normalized.cwd,
    localMode: normalized.localMode,
    text: dossier,
    files,
    instructionFiles: redactedInstructions,
    estimatedTokens: estimateTokens(dossier) + estimateFileTokens(files),
    redactions: mergeRedactions(...redactionSummaries),
    truncated,
    missingFiles: normalized.missingFiles,
    warnings: [...normalized.warnings, ...auto.warnings]
  };
}

function dedupeFiles(files: TechLeadFile[]): TechLeadFile[] {
  const byPath = new Map<string, TechLeadFile>();
  for (const file of files) {
    const existing = byPath.get(file.path);
    byPath.set(file.path, existing ? { ...existing, ...file, content: existing.content ?? file.content } : file);
  }
  return [...byPath.values()];
}

function dedupeInstructions(files: InstructionFile[]): InstructionFile[] {
  const byPath = new Map<string, InstructionFile>();
  for (const file of files) {
    byPath.set(file.path, byPath.get(file.path) ?? file);
  }
  return [...byPath.values()];
}
