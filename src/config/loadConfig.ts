import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { defaultConfig, mergeProviderModels, type TechLeadConfig } from "./defaults.js";
import type { JsonObject } from "../types.js";

const configCandidates = ["techlead.config.json", "techlead.config.ts", ".techleadrc.json"];

export async function loadConfig(cwd = process.cwd()): Promise<TechLeadConfig> {
  const explicit = process.env.TECHLEAD_CONFIG;
  const path = explicit ? resolve(cwd, explicit) : findConfig(cwd);
  const fileConfig = path ? await readConfigFile(path) : {};
  return applyEnv(mergeConfig(defaultConfig, fileConfig));
}

function findConfig(cwd: string): string | undefined {
  for (const candidate of configCandidates) {
    const path = resolve(cwd, candidate);
    if (existsSync(path)) return path;
  }
  return undefined;
}

async function readConfigFile(path: string): Promise<JsonObject> {
  if (path.endsWith(".json")) {
    return JSON.parse(await readFile(path, "utf8")) as JsonObject;
  }

  if (path.endsWith(".ts") || path.endsWith(".js") || path.endsWith(".mjs")) {
    const mod = (await import(pathToFileURL(path).href)) as { default?: unknown; config?: unknown };
    const value = mod.default ?? mod.config ?? {};
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Config file ${path} must export an object`);
    }
    return value as JsonObject;
  }

  throw new Error(`Unsupported config file extension for ${path}`);
}

export function mergeConfig(base: TechLeadConfig, override: JsonObject): TechLeadConfig {
  const merged: TechLeadConfig = {
    ...base,
    ...override,
    providerOrder: Array.isArray(override.providerOrder)
      ? (override.providerOrder as TechLeadConfig["providerOrder"])
      : base.providerOrder,
    models: mergeProviderModels(base.models, override.models as Parameters<typeof mergeProviderModels>[1]),
    routing: { ...base.routing, ...(override.routing as object | undefined) },
    context: { ...base.context, ...(override.context as object | undefined) },
    security: { ...base.security, ...(override.security as object | undefined) },
    telemetry: { ...base.telemetry, ...(override.telemetry as object | undefined) },
    http: { ...base.http, ...(override.http as object | undefined) }
  };

  return merged;
}

function applyEnv(config: TechLeadConfig): TechLeadConfig {
  const next = { ...config, context: { ...config.context }, security: { ...config.security }, http: { ...config.http } };

  if (isProviderOrAuto(process.env.TECHLEAD_DEFAULT_PROVIDER)) {
    next.defaultProvider = process.env.TECHLEAD_DEFAULT_PROVIDER;
  }
  if (process.env.TECHLEAD_HTTP_PORT) {
    next.http.port = Number(process.env.TECHLEAD_HTTP_PORT);
  }
  if (process.env.TECHLEAD_HTTP_HOST) {
    next.http.host = process.env.TECHLEAD_HTTP_HOST;
  }
  if (process.env.TECHLEAD_HTTP_BEARER_TOKEN) {
    next.http.bearerToken = process.env.TECHLEAD_HTTP_BEARER_TOKEN;
  }
  if (process.env.TECHLEAD_MAX_INPUT_TOKENS) {
    next.context.maxInputTokens = Number(process.env.TECHLEAD_MAX_INPUT_TOKENS);
  }
  if (process.env.TECHLEAD_MAX_FILE_TOKENS) {
    next.context.maxFileTokens = Number(process.env.TECHLEAD_MAX_FILE_TOKENS);
  }
  if (process.env.TECHLEAD_REDACT_SECRETS) {
    next.security.redactSecrets = parseBoolean(process.env.TECHLEAD_REDACT_SECRETS);
  }
  if (process.env.TECHLEAD_ALLOW_ENV_FILES) {
    next.security.allowEnvFiles = parseBoolean(process.env.TECHLEAD_ALLOW_ENV_FILES);
  }
  if (process.env.TECHLEAD_ALLOW_SYMLINKS_OUTSIDE_CWD) {
    next.security.allowSymlinksOutsideCwd = parseBoolean(process.env.TECHLEAD_ALLOW_SYMLINKS_OUTSIDE_CWD);
  }
  if (process.env.TECHLEAD_LOG_RAW_INPUTS) {
    next.security.logRawInputs = parseBoolean(process.env.TECHLEAD_LOG_RAW_INPUTS);
  }

  return next;
}

function parseBoolean(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function isProviderOrAuto(value: string | undefined): value is TechLeadConfig["defaultProvider"] {
  return value === "auto" || value === "openai" || value === "anthropic" || value === "gemini";
}
