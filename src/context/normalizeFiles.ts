import { lstat, readFile, realpath, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { isAbsolute, normalize, relative, resolve, sep } from "node:path";
import type { TechLeadConfig } from "../config/defaults.js";
import type { TechLeadFile } from "../types.js";

const ignoredPathSegments = new Set(["node_modules", "dist", "build", ".git", "coverage", "vendor"]);

export type NormalizeFilesOptions = {
  cwd: string;
  files: TechLeadFile[];
  allowLocalFiles: boolean;
  config: TechLeadConfig;
};

export type NormalizeFilesResult = {
  cwd: string;
  localMode: boolean;
  files: TechLeadFile[];
  missingFiles: string[];
  warnings: string[];
};

export async function normalizeFiles({
  cwd,
  files,
  allowLocalFiles,
  config
}: NormalizeFilesOptions): Promise<NormalizeFilesResult> {
  const resolvedCwd = allowLocalFiles ? resolve(cwd) : cwd;
  const localMode = allowLocalFiles && existsSync(resolvedCwd) && (await isDirectory(resolvedCwd));
  const rootRealPath = localMode ? await realpath(resolvedCwd) : undefined;
  const byPath = new Map<string, TechLeadFile>();
  const missingFiles: string[] = [];
  const warnings: string[] = [];

  for (const inputFile of files) {
    const normalizedPath = normalizeInputPath(inputFile.path, resolvedCwd, rootRealPath);
    if (!normalizedPath) {
      warnings.push(`Rejected unsafe path: ${inputFile.path}`);
      continue;
    }
    if (shouldIgnorePath(normalizedPath)) {
      warnings.push(`Ignored excluded path: ${normalizedPath}`);
      continue;
    }
    if (isEnvFile(normalizedPath) && !config.security.allowEnvFiles) {
      warnings.push(`Ignored env file by policy: ${normalizedPath}`);
      continue;
    }

    let content = inputFile.content;
    if (content === undefined && localMode) {
      const loaded = await readSafeFile(rootRealPath!, normalizedPath, config);
      if (loaded.ok) {
        content = loaded.content;
      } else {
        missingFiles.push(normalizedPath);
        warnings.push(loaded.reason);
      }
    } else if (content === undefined && !localMode) {
      missingFiles.push(normalizedPath);
      warnings.push(`Remote mode requires explicit content for ${normalizedPath}`);
    }

    const existing = byPath.get(normalizedPath);
    byPath.set(normalizedPath, mergeFile(existing, { ...inputFile, path: normalizedPath, content }));
  }

  return {
    cwd: resolvedCwd,
    localMode,
    files: [...byPath.values()],
    missingFiles,
    warnings
  };
}

export function normalizeInputPath(path: string, cwd: string, rootRealPath?: string): string | undefined {
  const root = rootRealPath ?? resolve(cwd);
  const absolute = isAbsolute(path) ? normalize(path) : resolve(root, path);
  const rel = relative(root, absolute);

  if (!rel || rel === "") return undefined;
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return undefined;
  return toPosixPath(rel);
}

export function toPosixPath(path: string): string {
  return normalize(path).split(sep).join("/");
}

export function shouldIgnorePath(path: string): boolean {
  return path.split("/").some(segment => ignoredPathSegments.has(segment));
}

export function isEnvFile(path: string): boolean {
  const basename = path.split("/").at(-1) ?? path;
  return basename === ".env" || basename.startsWith(".env.");
}

async function readSafeFile(
  rootRealPath: string,
  relativePath: string,
  config: TechLeadConfig
): Promise<{ ok: true; content: string } | { ok: false; reason: string }> {
  const absolute = resolve(rootRealPath, relativePath);
  const rel = relative(rootRealPath, absolute);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    return { ok: false, reason: `Rejected path outside cwd: ${relativePath}` };
  }

  try {
    const linkStat = await lstat(absolute);
    if (linkStat.isSymbolicLink() && !config.security.allowSymlinksOutsideCwd) {
      const real = await realpath(absolute);
      const realRel = relative(rootRealPath, real);
      if (realRel === ".." || realRel.startsWith(`..${sep}`) || isAbsolute(realRel)) {
        return { ok: false, reason: `Rejected symlink escaping cwd: ${relativePath}` };
      }
    }

    const fileStat = await stat(absolute);
    if (!fileStat.isFile()) return { ok: false, reason: `Not a regular file: ${relativePath}` };
    if (fileStat.size > config.context.maxFileBytes) {
      return { ok: false, reason: `File exceeds max file size: ${relativePath}` };
    }
    return { ok: true, content: await readFile(absolute, "utf8") };
  } catch (error) {
    return { ok: false, reason: `Could not read ${relativePath}: ${(error as Error).message}` };
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function mergeFile(existing: TechLeadFile | undefined, next: TechLeadFile): TechLeadFile {
  if (!existing) return next;
  return {
    ...existing,
    ...next,
    content: existing.content ?? next.content,
    summary: existing.summary ?? next.summary,
    reason: existing.reason ?? next.reason,
    importance: moreImportant(existing.importance, next.importance),
    kind: existing.kind ?? next.kind
  };
}

function moreImportant(a: TechLeadFile["importance"], b: TechLeadFile["importance"]): TechLeadFile["importance"] {
  const order = ["low", "medium", "high", "critical"] as const;
  if (!a) return b;
  if (!b) return a;
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}
