export type RedactionSummary = Array<{ type: string; count: number }>;

type SecretPattern = {
  type: string;
  pattern: RegExp;
};

const secretPatterns: SecretPattern[] = [
  {
    type: "private_key",
    pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g
  },
  {
    type: "ssh_private_key",
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/g
  },
  {
    type: "aws_access_key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g
  },
  {
    type: "github_token",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{30,}\b/g
  },
  {
    type: "npm_token",
    pattern: /\bnpm_[A-Za-z0-9]{20,}\b/g
  },
  {
    type: "openai_key",
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g
  },
  {
    type: "anthropic_key",
    pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g
  },
  {
    type: "google_api_key",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g
  },
  {
    type: "bearer_token",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/gi
  },
  {
    type: "database_url",
    pattern: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'<>]+/gi
  },
  {
    type: "env_assignment",
    pattern:
      /(^|\n)([A-Z0-9_]*(?:SECRET|TOKEN|API[_-]?KEY|PASSWORD|PASSWD|PRIVATE[_-]?KEY|CONNECTION[_-]?STRING)[A-Z0-9_]*\s*=\s*)(["']?)[^\n"']{8,}\3/gi
  },
  {
    type: "azure_key",
    pattern: /\b[A-Za-z0-9+/]{86}==\b/g
  }
];

export function redactSecrets(input: string): { text: string; redactions: RedactionSummary } {
  const counts = new Map<string, number>();
  let text = input;

  for (const { type, pattern } of secretPatterns) {
    text = text.replace(pattern, (...args: unknown[]) => {
      const match = String(args[0]);
      counts.set(type, (counts.get(type) ?? 0) + 1);
      if (type === "env_assignment") {
        const prefix = String(args[1] ?? "") + String(args[2] ?? "");
        return `${prefix}[REDACTED_SECRET:${type}]`;
      }
      if (/^Bearer\s+/i.test(match)) {
        return "Bearer [REDACTED_SECRET:bearer_token]";
      }
      return `[REDACTED_SECRET:${type}]`;
    });
  }

  return {
    text,
    redactions: [...counts.entries()].map(([type, count]) => ({ type, count }))
  };
}

export function mergeRedactions(...summaries: RedactionSummary[]): RedactionSummary {
  const counts = new Map<string, number>();
  for (const summary of summaries) {
    for (const item of summary) counts.set(item.type, (counts.get(item.type) ?? 0) + item.count);
  }
  return [...counts.entries()].map(([type, count]) => ({ type, count }));
}
