import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TechLeadConfig } from "../config/defaults.js";
import { defaultConfig } from "../config/defaults.js";
import { createDefaultProviders, type ProviderRegistry } from "../providers/index.js";
import { registerPlanTool } from "./tools/planTool.js";
import { registerReviewTool } from "./tools/reviewTool.js";

export type CreateTechLeadServerOptions = {
  config?: TechLeadConfig;
  providers?: ProviderRegistry;
  allowLocalFiles?: boolean;
};

export function createTechLeadServer(options: CreateTechLeadServerOptions = {}): McpServer {
  const config = options.config ?? defaultConfig;
  const providers = options.providers ?? createDefaultProviders();
  const allowLocalFiles = options.allowLocalFiles ?? true;

  const server = new McpServer(
    {
      name: "techlead-mcp",
      version: "0.1.0"
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );

  registerPlanTool(server, config, providers, allowLocalFiles);
  registerReviewTool(server, config, providers, allowLocalFiles);

  return server;
}
