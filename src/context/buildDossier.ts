import type { InstructionFile, TechLeadFile, TestResult } from "../types.js";

export type BuildDossierInput = {
  cwd: string;
  task: string;
  constraints?: string[];
  knownProblems?: string[];
  previousAttempts?: string[];
  planningMode?: string;
  reviewerFocus?: string[];
  instructionFiles: InstructionFile[];
  files: TechLeadFile[];
  changedFiles?: TechLeadFile[];
  diff?: string;
  plan?: unknown;
  testResults?: TestResult[];
  warnings?: string[];
};

export function buildDossier(input: BuildDossierInput): string {
  const parts: string[] = [];
  parts.push("<techlead_context>");
  parts.push(`  <cwd>${escapeXml(input.cwd)}</cwd>`);
  parts.push("");
  appendTextBlock(parts, "task", input.task, 2);

  appendList(parts, "constraints", input.constraints, 2);
  appendList(parts, "known_problems", input.knownProblems, 2);
  appendList(parts, "previous_attempts", input.previousAttempts, 2);
  if (input.planningMode) appendTextBlock(parts, "planning_mode", input.planningMode, 2);
  appendList(parts, "reviewer_focus", input.reviewerFocus, 2);
  appendList(parts, "context_warnings", input.warnings, 2);

  if (input.instructionFiles.length > 0) {
    parts.push("  <project_instructions>");
    for (const file of input.instructionFiles) {
      appendFile(parts, file.path, "instructions", undefined, file.source, file.content, 4);
    }
    parts.push("  </project_instructions>");
    parts.push("");
  }

  if (input.files.length > 0) {
    parts.push("  <files>");
    for (const file of input.files) {
      appendFile(
        parts,
        file.path,
        file.kind,
        file.importance,
        file.reason,
        file.content ?? file.summary ?? "[content not provided]",
        4,
        file.lineStart,
        file.lineEnd
      );
    }
    parts.push("  </files>");
    parts.push("");
  }

  if (input.changedFiles?.length) {
    parts.push("  <changed_files>");
    for (const file of input.changedFiles) {
      appendFile(
        parts,
        file.path,
        file.kind,
        file.importance,
        file.reason,
        file.content ?? file.summary ?? "[content not provided]",
        4,
        file.lineStart,
        file.lineEnd
      );
    }
    parts.push("  </changed_files>");
    parts.push("");
  }

  if (input.plan !== undefined) {
    appendTextBlock(
      parts,
      "plan",
      typeof input.plan === "string" ? input.plan : JSON.stringify(input.plan, null, 2),
      2
    );
  }

  if (input.diff) {
    appendTextBlock(parts, "diff", input.diff, 2);
  }

  if (input.testResults?.length) {
    parts.push("  <test_results>");
    for (const result of input.testResults) {
      parts.push(
        `    <test_result command="${escapeXml(result.command)}" status="${escapeXml(result.status)}">`
      );
      parts.push(indent(escapeXml(result.output), 6));
      parts.push("    </test_result>");
    }
    parts.push("  </test_results>");
    parts.push("");
  }

  parts.push("</techlead_context>");
  return parts.join("\n");
}

function appendFile(
  parts: string[],
  path: string,
  kind: string | undefined,
  importance: string | undefined,
  reason: string | undefined,
  content: string,
  spaces: number,
  lineStart?: number,
  lineEnd?: number
): void {
  const attrs = [
    `path="${escapeXml(path)}"`,
    kind ? `kind="${escapeXml(kind)}"` : undefined,
    importance ? `importance="${escapeXml(importance)}"` : undefined,
    reason ? `reason="${escapeXml(reason)}"` : undefined,
    lineStart ? `lineStart="${lineStart}"` : undefined,
    lineEnd ? `lineEnd="${lineEnd}"` : undefined
  ]
    .filter(Boolean)
    .join(" ");
  parts.push(`${" ".repeat(spaces)}<file ${attrs}>`);
  parts.push(indent(escapeXml(content), spaces + 2));
  parts.push(`${" ".repeat(spaces)}</file>`);
}

function appendTextBlock(parts: string[], tag: string, text: string, spaces: number): void {
  parts.push(`${" ".repeat(spaces)}<${tag}>`);
  parts.push(indent(escapeXml(text), spaces + 2));
  parts.push(`${" ".repeat(spaces)}</${tag}>`);
  parts.push("");
}

function appendList(parts: string[], tag: string, items: string[] | undefined, spaces: number): void {
  if (!items?.length) return;
  parts.push(`${" ".repeat(spaces)}<${tag}>`);
  for (const item of items) {
    parts.push(`${" ".repeat(spaces + 2)}<item>${escapeXml(item)}</item>`);
  }
  parts.push(`${" ".repeat(spaces)}</${tag}>`);
  parts.push("");
}

function indent(text: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return text
    .split("\n")
    .map(line => `${prefix}${line}`)
    .join("\n");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
