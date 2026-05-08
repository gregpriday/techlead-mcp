import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TechLeadConfig } from "../../config/defaults.js";
import { plan } from "../../core/plan.js";
import { toMcpResult } from "../../core/output.js";
import type { ProviderRegistry } from "../../providers/index.js";
import { techLeadPlanInputSchema } from "../schemas/inputSchemas.js";
import { techLeadPlanOutputSchema } from "../schemas/outputSchemas.js";

export function registerPlanTool(
  server: McpServer,
  config: TechLeadConfig,
  providers: ProviderRegistry,
  allowLocalFiles: boolean
): void {
  server.registerTool(
    "techlead.plan",
    {
      title: "TechLead Plan",
      description:
        "Use this tool when you need a senior technical lead to create an implementation plan before editing code. Provide cwd, the task or issue, relevant files and contents, project instructions if available, constraints, known problems, and previous attempts when relevant. The tool returns a structured plan for a cheaper executor model, including target files, ordered steps, risks, acceptance criteria, and tests to run.",
      inputSchema: techLeadPlanInputSchema.shape,
      outputSchema: techLeadPlanOutputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async args => {
      const output = await plan(args, { config, providers, allowLocalFiles });
      return toMcpResult(output);
    }
  );
}
