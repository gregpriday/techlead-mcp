import type { TechLeadConfig } from "../config/defaults.js";

export type GitHubIssueReference = {
  owner?: string;
  repo?: string;
  repository?: string;
  issueNumber: number;
};

type GitHubIssueApiResponse = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user?: { login?: string };
  created_at?: string;
  updated_at?: string;
  labels?: Array<{ name?: string }>;
};

type GitHubIssueCommentApiResponse = {
  body: string | null;
  html_url: string;
  user?: { login?: string };
  created_at?: string;
  updated_at?: string;
};

export async function resolveGitHubIssueTask(
  reference: GitHubIssueReference,
  config: TechLeadConfig,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const { owner, repo } = parseRepository(reference);
  const token = findGitHubToken(config);
  if (!token) {
    throw new Error(
      `githubIssue requires one of these environment variables: ${config.github.tokenEnvVars.join(", ")}`
    );
  }

  const issue = await githubGet<GitHubIssueApiResponse>(
    `${config.github.apiBaseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${reference.issueNumber}`,
    token,
    fetchImpl
  );
  const comments = await listIssueComments(owner, repo, reference.issueNumber, token, config, fetchImpl);

  return formatIssueTask(owner, repo, issue, comments);
}

function parseRepository(reference: GitHubIssueReference): { owner: string; repo: string } {
  if (reference.repository) {
    const [owner, repo] = reference.repository.split("/");
    if (!owner || !repo) throw new Error("githubIssue.repository must use owner/repo format");
    return { owner, repo };
  }
  if (!reference.owner || !reference.repo) {
    throw new Error("githubIssue requires either repository or owner and repo");
  }
  return { owner: reference.owner, repo: reference.repo };
}

function findGitHubToken(config: TechLeadConfig): string | undefined {
  for (const envVar of config.github.tokenEnvVars) {
    const value = process.env[envVar];
    if (value) return value;
  }
  return undefined;
}

async function listIssueComments(
  owner: string,
  repo: string,
  issueNumber: number,
  token: string,
  config: TechLeadConfig,
  fetchImpl: typeof fetch
): Promise<GitHubIssueCommentApiResponse[]> {
  const comments: GitHubIssueCommentApiResponse[] = [];
  let page = 1;

  while (comments.length < config.github.maxComments) {
    const remaining = config.github.maxComments - comments.length;
    const perPage = Math.min(100, remaining);
    const url = `${config.github.apiBaseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo
    )}/issues/${issueNumber}/comments?per_page=${perPage}&page=${page}`;
    const batch = await githubGet<GitHubIssueCommentApiResponse[]>(url, token, fetchImpl);
    comments.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return comments;
}

async function githubGet<T>(url: string, token: string, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "techlead-mcp"
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`GitHub API request failed (${response.status}): ${text || response.statusText}`);
  }

  return (await response.json()) as T;
}

function formatIssueTask(
  owner: string,
  repo: string,
  issue: GitHubIssueApiResponse,
  comments: GitHubIssueCommentApiResponse[]
): string {
  const labels = issue.labels?.map(label => label.name).filter(Boolean).join(", ") || "none";
  const parts: string[] = [
    `GitHub issue source: ${owner}/${repo}#${issue.number}`,
    `URL: ${issue.html_url}`,
    `State: ${issue.state}`,
    `Author: ${issue.user?.login ?? "unknown"}`,
    `Created: ${issue.created_at ?? "unknown"}`,
    `Updated: ${issue.updated_at ?? "unknown"}`,
    `Labels: ${labels}`,
    "",
    `Title: ${issue.title}`,
    "",
    "Issue body:",
    issue.body?.trim() || "[no issue body]"
  ];

  if (comments.length > 0) {
    parts.push("", `Comments (${comments.length}):`);
    comments.forEach((comment, index) => {
      parts.push(
        "",
        `Comment ${index + 1}`,
        `Author: ${comment.user?.login ?? "unknown"}`,
        `URL: ${comment.html_url}`,
        `Created: ${comment.created_at ?? "unknown"}`,
        `Updated: ${comment.updated_at ?? "unknown"}`,
        comment.body?.trim() || "[no comment body]"
      );
    });
  } else {
    parts.push("", "Comments: none");
  }

  return parts.join("\n");
}
