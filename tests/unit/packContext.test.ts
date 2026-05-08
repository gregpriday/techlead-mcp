import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/config/defaults.js";
import type { TechLeadConfig } from "../../src/config/defaults.js";
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
      configForRoot(dir),
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
      configForRoot(dir),
      true
    );

    expect(dossier.files.some(file => file.path === ".env")).toBe(false);
    expect(dossier.warnings.join("\n")).toContain("Rejected unsafe path");
    expect(dossier.warnings.join("\n")).toContain("Ignored env file by policy");
  });

  it("rejects cwd outside allowed roots", async () => {
    await expect(
      packContext(
        {
          cwd: dir,
          task: "Read files",
          files: [{ path: "src.ts" }]
        },
        configForRoot(process.cwd()),
        true
      )
    ).rejects.toThrow("cwd is outside allowed TechLead MCP roots");
  });

  it("blocks hidden files by default", async () => {
    await writeFile(join(dir, ".hidden.ts"), "export const hidden = true;", "utf8");

    const dossier = await packContext(
      {
        cwd: dir,
        task: "Read hidden",
        files: [{ path: ".hidden.ts" }]
      },
      configForRoot(dir),
      true
    );

    expect(dossier.files.some(file => file.path === ".hidden.ts")).toBe(false);
    expect(dossier.warnings.join("\n")).toContain("Ignored hidden path by policy");
  });

  it("keeps changedFiles separate from surrounding files", async () => {
    const dossier = await packContext(
      {
        cwd: "remote",
        task: "Review change",
        files: [{ path: "src.ts", content: "export const value = 1;", kind: "source" }],
        changedFiles: [{ path: "src.ts", content: "export const value = 2;", kind: "source" }],
        diff: "-export const value = 1;\n+export const value = 2;"
      },
      defaultConfig,
      false
    );

    expect(dossier.files[0]?.content).toContain("value = 1");
    expect(dossier.changedFiles[0]?.content).toContain("value = 2");
    expect(dossier.text).toContain("<files>");
    expect(dossier.text).toContain("<changed_files>");
    expect(dossier.text).toContain("value = 1");
    expect(dossier.text).toContain("value = 2");
  });

  it("rejects oversized provided content", async () => {
    const config = {
      ...defaultConfig,
      context: { ...defaultConfig.context, maxFileBytes: 10, maxTotalBytes: 100 },
      security: { ...defaultConfig.security, allowedRoots: [dir] }
    };

    await expect(
      packContext(
        {
          cwd: "remote",
          task: "Huge content",
          files: [{ path: "src.ts", content: "x".repeat(11) }]
        },
        config,
        false
      )
    ).rejects.toThrow("exceeds maxFileBytes");
  });
});

function configForRoot(root: string): TechLeadConfig {
  return {
    ...defaultConfig,
    security: {
      ...defaultConfig.security,
      allowedRoots: [root]
    }
  };
}
