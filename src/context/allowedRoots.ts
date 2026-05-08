import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export async function assertCwdWithinAllowedRoots(cwd: string, allowedRoots: string[]): Promise<string> {
  const cwdReal = await realpath(resolve(cwd));
  const allowedRootReals = await Promise.all(allowedRoots.map(root => realpath(resolve(root))));
  const allowed = allowedRootReals.some(root => isPathInside(root, cwdReal));

  if (!allowed) {
    throw new Error(`cwd is outside allowed TechLead MCP roots: ${cwd}`);
  }

  return cwdReal;
}

export function isPathInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}
