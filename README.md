# TechLead MCP

`@gpriday/techlead-mcp` is a read-only MCP server that gives coding agents two structured tools:

- `techlead.plan`
- `techlead.review`

It supports local stdio mode and remote Streamable HTTP mode, uses provider-side structured outputs, and can route across OpenAI, Anthropic Claude, and Gemini.

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

## Run

```bash
techlead-mcp serve --transport stdio
techlead-mcp serve --transport http --port 8787
techlead-mcp models
```

Local stdio mode may read safe files under `cwd`. HTTP mode treats `cwd` as a logical label and requires callers to provide file contents.
