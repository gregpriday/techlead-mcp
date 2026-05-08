import { describe, expect, it } from "vitest";
import { redactSecrets } from "../../src/context/redactSecrets.js";

describe("redactSecrets", () => {
  it("redacts common secret patterns", () => {
    const result = redactSecrets(`OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz123456
Authorization: Bearer abcdefghijklmnopqrstuvwxyz1234567890
DATABASE_URL=postgres://user:pass@example.com/db`);

    expect(result.text).toContain("[REDACTED_SECRET:env_assignment]");
    expect(result.text).toContain("Bearer [REDACTED_SECRET:bearer_token]");
    expect(result.text).toContain("[REDACTED_SECRET:database_url]");
    expect(result.redactions.map(item => item.type)).toEqual(
      expect.arrayContaining(["env_assignment", "bearer_token", "database_url"])
    );
  });
});
