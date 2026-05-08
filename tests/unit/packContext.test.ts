import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/config/defaults.js";
import { packContext } from "../../src/context/packContext.js";

describe("packContext", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "techlead-mcp-"));
    await writeFile(join(dir, "AGENTS.md"), "Use focused changes.", "utf8");
    await writeFile(join(dir, "README.md"), "# Demo", "utf8");
    await writeFile(join(dir, "src.ts"), "export const token = 'sk-abcdefghijklmnopqrstuvwxyz123456';", "utf8");
    await writeFile(join(dir, ".env"), "SECRET_TOKEN=abc1234567890", "utf8");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("loads safe local files and auto instructions under cwd", async () => {
    const dossier = await packContext(
      {
        cwd: dir,
        task: "Review src",
        files: [{ path: "src.ts", importance: "critical" }],
        autoLoadInstructions: true
      },
      defaultConfig,
      true
    );

    expect(dossier.localMode).toBe(true);
    expect(dossier.text).toContain("AGENTS.md");
    expect(dossier.text).toContain("README.md");
    expect(dossier.text).toContain("[REDACTED_SECRET:openai_key]");
    expect(dossier.missingFiles).toEqual([]);
  });

  it("rejects path traversal and env files by default", async () => {
    const dossier = await packContext(
      {
        cwd: dir,
        task: "Read files",
        files: [{ path: "../outside.ts" }, { path: ".env" }]
      },
      defaultConfig,
      true
    );

    expect(dossier.files.some(file => file.path === ".env")).toBe(false);
    expect(dossier.warnings.join("\n")).toContain("Rejected unsafe path");
    expect(dossier.warnings.join("\n")).toContain("Ignored env file by policy");
  });
});
