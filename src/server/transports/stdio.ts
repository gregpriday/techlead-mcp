import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { TechLeadConfig } from "../../config/defaults.js";
import { createDefaultProviders, type ProviderRegistry } from "../../providers/index.js";
import { createTechLeadServer } from "../createServer.js";

export type ServeStdioOptions = {
  config: TechLeadConfig;
  providers?: ProviderRegistry;
};

export async function serveStdio({ config, providers = createDefaultProviders() }: ServeStdioOptions): Promise<void> {
  const server = createTechLeadServer({ config, providers, allowLocalFiles: true });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
