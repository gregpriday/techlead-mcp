#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import { defaultConfig } from "./config/defaults.js";
import { loadConfig } from "./config/loadConfig.js";
import { serveHttp } from "./server/transports/http.js";
import { serveStdio } from "./server/transports/stdio.js";
import { runEvalHarness } from "./evals/harness.js";

const program = new Command();

program
  .name("techlead-mcp")
  .description("Read-only MCP server for frontier-quality coding-agent planning and review.")
  .version("0.1.0");

program
  .command("serve")
  .description("Start the TechLead MCP server.")
  .option("-t, --transport <transport>", "Transport to use: stdio or http", process.env.TECHLEAD_TRANSPORT ?? "stdio")
  .option("-p, --port <port>", "HTTP port", process.env.TECHLEAD_HTTP_PORT)
  .option("--host <host>", "HTTP host", process.env.TECHLEAD_HTTP_HOST)
  .action(async options => {
    const config = await loadConfig();
    const transport = String(options.transport);
    if (transport === "stdio") {
      await serveStdio({ config });
      return;
    }
    if (transport === "http") {
      const port = options.port ? Number(options.port) : config.http.port;
      const host = options.host ? String(options.host) : config.http.host;
      const server = await serveHttp({ config, port, host });
      console.error(`TechLead MCP listening at ${server.url}`);
      process.on("SIGINT", async () => {
        await server.close();
        process.exit(0);
      });
      process.on("SIGTERM", async () => {
        await server.close();
        process.exit(0);
      });
      return;
    }
    throw new Error(`Unsupported transport: ${transport}`);
  });

program
  .command("init")
  .description("Create a starter techlead.config.json in the current directory.")
  .option("-f, --force", "Overwrite an existing config file", false)
  .action(async options => {
    const path = resolve(process.cwd(), "techlead.config.json");
    if (existsSync(path) && !options.force) {
      throw new Error("techlead.config.json already exists. Use --force to overwrite it.");
    }
    await writeFile(path, `${JSON.stringify(defaultConfig, null, 2)}\n`, "utf8");
    console.log(`Created ${path}`);
  });

program
  .command("models")
  .description("Print the configured provider model catalog.")
  .action(async () => {
    const config = await loadConfig();
    console.log(JSON.stringify(config.models, null, 2));
  });

program
  .command("eval")
  .description("Run the lightweight eval harness against a JSON fixture file.")
  .argument("<fixture>", "Path to eval fixture JSON")
  .action(async fixture => {
    const config = await loadConfig();
    const fixturePath = resolve(process.cwd(), fixture);
    const raw = await readFile(fixturePath, "utf8");
    const report = await runEvalHarness(JSON.parse(raw), { config });
    console.log(JSON.stringify(report, null, 2));
  });

program.parseAsync().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
