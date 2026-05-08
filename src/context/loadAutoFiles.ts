import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import type { TechLeadConfig } from "../config/defaults.js";
import type { InstructionFile, TechLeadFile } from "../types.js";
import { isEnvFile, shouldIgnorePath, toPosixPath } from "./normalizeFiles.js";

const instructionFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  ".gemini/AGENTS.md",
  ".github/copilot-instructions.md",
  ".cursorrules",
  ".windsurfrules"
];

const metadataFiles = [
  "README.md",
  "package.json",
  "pnpm-workspace.yaml",
  "yarn.lock",
  "package-lock.json",
  "turbo.json",
  "nx.json",
  "tsconfig.json",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "Cargo.toml",
  "Gemfile",
  "composer.json"
];

const metadataGlobs = ["vite.config.", "next.config."];

export type AutoLoadedContext = {
  instructionFiles: InstructionFile[];
  projectFiles: TechLeadFile[];
  warnings: string[];
};

export async function loadAutoFiles(
  cwd: string,
  config: TechLeadConfig,
  allowLocalFiles: boolean
): Promise<AutoLoadedContext> {
  if (!allowLocalFiles || !existsSync(cwd)) {
    return { instructionFiles: [], projectFiles: [], warnings: [] };
  }

  const root = await realpath(resolve(cwd));
  const warnings: string[] = [];
  const loadedInstructions: InstructionFile[] = [];
  const loadedProjectFiles: TechLeadFile[] = [];

  for (const path of instructionFiles) {
    const content = await maybeRead(root, path, config, warnings);
    if (content !== undefined) {
      loadedInstructions.push({ path, content, source: "auto_loaded" });
    }
  }

  for (const path of await cursorRuleFiles(root)) {
    const content = await maybeRead(root, path, config, warnings);
    if (content !== undefined) {
      loadedInstructions.push({ path, content, source: "auto_loaded" });
    }
  }

  if (config.context.autoLoadProjectMetadata) {
    for (const path of metadataFiles) {
      const content = await maybeRead(root, path, config, warnings);
      if (content !== undefined) {
        loadedProjectFiles.push({ path, content, kind: classifyAutoFile(path), importance: "low" });
      }
    }

    for (const path of await configFilesByPrefix(root)) {
      const content = await maybeRead(root, path, config, warnings);
      if (content !== undefined) {
        loadedProjectFiles.push({ path, content, kind: "config", importance: "low" });
      }
    }
  }

  return { instructionFiles: loadedInstructions, projectFiles: loadedProjectFiles, warnings };
}

function classifyAutoFile(path: string): TechLeadFile["kind"] {
  if (path === "README.md") return "docs";
  return "config";
}

async function maybeRead(
  root: string,
  path: string,
  config: TechLeadConfig,
  warnings: string[]
): Promise<string | undefined> {
  if (shouldIgnorePath(path)) return undefined;
  if (isEnvFile(path) && !config.security.allowEnvFiles) return undefined;

  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  if (rel === ".." || rel.startsWith(`..${sep}`)) return undefined;

  try {
    const fileStat = await stat(absolute);
    if (!fileStat.isFile()) return undefined;
    if (fileStat.size > config.context.maxFileBytes) {
      warnings.push(`Auto-load skipped large file: ${path}`);
      return undefined;
    }
    return await readFile(absolute, "utf8");
  } catch {
    return undefined;
  }
}

async function cursorRuleFiles(root: string): Promise<string[]> {
  const dir = join(root, ".cursor", "rules");
  if (!existsSync(dir)) return [];

  const files: string[] = [];
  await walk(dir, files, root);
  return files.filter(path => !shouldIgnorePath(path));
}

async function configFilesByPrefix(root: string): Promise<string[]> {
  const entries = await safeReaddir(root);
  return entries
    .filter(entry => metadataGlobs.some(prefix => entry.startsWith(prefix)))
    .map(entry => toPosixPath(entry));
}

async function walk(dir: string, out: string[], root: string): Promise<void> {
  for (const entry of await safeReaddir(dir)) {
    const absolute = join(dir, entry);
    const rel = toPosixPath(relative(root, absolute));
    if (shouldIgnorePath(rel)) continue;
    const fileStat = await stat(absolute).catch(() => undefined);
    if (!fileStat) continue;
    if (fileStat.isDirectory()) {
      await walk(absolute, out, root);
    } else if (fileStat.isFile()) {
      out.push(rel);
    }
  }
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}
