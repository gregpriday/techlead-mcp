import { afterEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/config/defaults.js";
import { resolveGitHubIssueTask } from "../../src/github/issues.js";

describe("resolveGitHubIssueTask", () => {
  const originalToken = process.env.TECHLEAD_GITHUB_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.TECHLEAD_GITHUB_TOKEN;
    } else {
      process.env.TECHLEAD_GITHUB_TOKEN = originalToken;
    }
  });

  it("requires a GitHub token when githubIssue is used", async () => {
    delete process.env.TECHLEAD_GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;

    await expect(
      resolveGitHubIssueTask({ repository: "owner/repo", issueNumber: 12 }, defaultConfig, async () => {
        throw new Error("fetch should not be called");
      })
    ).rejects.toThrow("githubIssue requires one of these environment variables");
  });

  it("loads issue text and comments through the GitHub API", async () => {
    process.env.TECHLEAD_GITHUB_TOKEN = "token";
    const urls: string[] = [];
    const fetchImpl = async (input: string | URL | Request) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/issues/42/comments")) {
        return jsonResponse([
          {
            body: "First comment",
            html_url: "https://github.com/owner/repo/issues/42#issuecomment-1",
            user: { login: "reviewer" },
            created_at: "2026-01-02T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z"
          }
        ]);
      }
      return jsonResponse({
        number: 42,
        title: "Fix duplicate invoices",
        body: "Users can double-click submit.",
        state: "open",
        html_url: "https://github.com/owner/repo/issues/42",
        user: { login: "reporter" },
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        labels: [{ name: "bug" }]
      });
    };

    const task = await resolveGitHubIssueTask({ repository: "owner/repo", issueNumber: 42 }, defaultConfig, fetchImpl);

    expect(urls[0]).toContain("/repos/owner/repo/issues/42");
    expect(urls[1]).toContain("/repos/owner/repo/issues/42/comments");
    expect(task).toContain("GitHub issue source: owner/repo#42");
    expect(task).toContain("Title: Fix duplicate invoices");
    expect(task).toContain("Users can double-click submit.");
    expect(task).toContain("First comment");
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body
  } as Response;
}
