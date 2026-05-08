import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TechLeadConfig } from "../../config/defaults.js";
import { review } from "../../core/review.js";
import { toMcpResult } from "../../core/output.js";
import type { ProviderRegistry } from "../../providers/index.js";
import { techLeadReviewInputSchema } from "../schemas/inputSchemas.js";
import { techLeadReviewOutputSchema } from "../schemas/outputSchemas.js";

export function registerReviewTool(
  server: McpServer,
  config: TechLeadConfig,
  providers: ProviderRegistry,
  allowLocalFiles: boolean
): void {
  server.registerTool(
    "techlead.review",
    {
      title: "TechLead Review",
      description:
        "Use this tool when you need a senior technical lead to review a proposed code change before finalizing. Provide cwd, the original task, original plan if available, changed files, diff, relevant surrounding files, and test results/logs. The tool returns a structured review with verdict, blocking issues, non-blocking notes, missing tests, plan adherence, and next actions for the executor.",
      inputSchema: techLeadReviewInputSchema.shape,
      outputSchema: techLeadReviewOutputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async args => {
      const output = await review(args, { config, providers, allowLocalFiles });
      return toMcpResult(output);
    }
  );
}
