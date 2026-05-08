# TechLead MCP

`@gpriday/techlead-mcp` is a read-only MCP server that gives coding agents two structured tools:

- `techlead.plan`
- `techlead.review`

It supports local stdio mode, uses provider-side structured outputs, and can route across OpenAI, Anthropic Claude, and Gemini.

Each tool response includes the structured plan/review, provider token usage when returned by the API, and an estimated USD provider cost derived from the configured per-model pricing catalog. Provider billing dashboards remain authoritative.

## Install

```bash
npm install -g @gpriday/techlead-mcp
```

## Configure

Create a `.env` with at least one provider key:

```bash
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
```

Optional config:

```bash
techlead-mcp init
```

Optional GitHub issue task source:

```bash
TECHLEAD_GITHUB_TOKEN=github_pat_or_fine_grained_token
```

Then callers may omit `task` and provide:

```json
{
  "cwd": "/repo",
  "githubIssue": {
    "repository": "owner/repo",
    "issueNumber": 123
  },
  "files": []
}
```

The server reads the issue body and issue comments through the GitHub REST API and uses that text as the task.

## Run

```bash
techlead-mcp serve
techlead-mcp models
```

TechLead MCP is stdio-only because it is designed to run next to the repository and read safe files under configured local roots. By default, local reads are restricted to the process working directory. Do not run the server from a sensitive parent directory.
