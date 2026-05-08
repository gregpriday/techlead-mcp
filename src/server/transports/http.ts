import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { TechLeadConfig } from "../../config/defaults.js";
import { createDefaultProviders, type ProviderRegistry } from "../../providers/index.js";
import { createTechLeadServer } from "../createServer.js";

export type ServeHttpOptions = {
  config: TechLeadConfig;
  providers?: ProviderRegistry;
  port?: number;
  host?: string;
};

type Session = {
  server: ReturnType<typeof createTechLeadServer>;
  transport: StreamableHTTPServerTransport;
};

export async function serveHttp({
  config,
  providers = createDefaultProviders(),
  port = config.http.port,
  host = config.http.host
}: ServeHttpOptions): Promise<{ close: () => Promise<void>; url: string }> {
  const sessions = new Map<string, Session>();
  const rateLimit = createRateLimit(config.http.rateLimitPerMinute);

  const httpServer = createServer(async (req, res) => {
    try {
      if (!isAllowedOrigin(req, config)) {
        writeJson(res, 403, errorResponse("Forbidden origin"));
        return;
      }

      if (!isAuthorized(req, config)) {
        writeJson(res, 401, errorResponse("Unauthorized"));
        return;
      }

      if (!rateLimit(req)) {
        writeJson(res, 429, errorResponse("Rate limit exceeded"));
        return;
      }

      if (req.url !== "/mcp") {
        writeJson(res, 404, errorResponse("Not found"));
        return;
      }

      if (req.method === "POST") {
        const body = await readJsonBody(req);
        await handlePost(req, res, body, sessions, config, providers);
        return;
      }

      if (req.method === "GET" || req.method === "DELETE") {
        const sessionId = headerValue(req.headers["mcp-session-id"]);
        const session = sessionId ? sessions.get(sessionId) : undefined;
        if (!session) {
          writeJson(res, 405, errorResponse("Method not allowed"));
          return;
        }
        await session.transport.handleRequest(req, res);
        return;
      }

      writeJson(res, 405, errorResponse("Method not allowed"));
    } catch (error) {
      if (!res.headersSent) writeJson(res, 500, errorResponse((error as Error).message));
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, () => {
      httpServer.off("error", reject);
      resolve();
    });
  });

  return {
    url: `http://${host}:${port}/mcp`,
    close: async () => {
      for (const session of sessions.values()) {
        await session.transport.close();
        await session.server.close();
      }
      await new Promise<void>((resolve, reject) => {
        httpServer.close(error => (error ? reject(error) : resolve()));
      });
    }
  };
}

async function handlePost(
  req: IncomingMessage,
  res: ServerResponse,
  body: unknown,
  sessions: Map<string, Session>,
  config: TechLeadConfig,
  providers: ProviderRegistry
): Promise<void> {
  const sessionId = headerValue(req.headers["mcp-session-id"]);
  const existing = sessionId ? sessions.get(sessionId) : undefined;
  if (existing) {
    await existing.transport.handleRequest(req, res, body);
    return;
  }

  if (!isInitializeRequest(body)) {
    writeJson(res, 400, errorResponse("Bad Request: No valid session ID provided"));
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: id => {
      sessions.set(id, { server, transport });
    }
  });
  const server = createTechLeadServer({ config, providers, allowLocalFiles: false });
  transport.onclose = () => {
    const id = transport.sessionId;
    if (id) sessions.delete(id);
  };
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function isAllowedOrigin(req: IncomingMessage, config: TechLeadConfig): boolean {
  const origin = headerValue(req.headers.origin);
  if (!origin) return true;
  return config.http.allowedOrigins.some(allowed => origin === allowed || origin.startsWith(`${allowed}:`));
}

function isAuthorized(req: IncomingMessage, config: TechLeadConfig): boolean {
  if (!config.http.bearerToken) return true;
  const auth = headerValue(req.headers.authorization);
  return auth === `Bearer ${config.http.bearerToken}`;
}

function createRateLimit(limitPerMinute: number): (req: IncomingMessage) => boolean {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return req => {
    const now = Date.now();
    const key = req.socket.remoteAddress ?? "unknown";
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    if (bucket.count >= limitPerMinute) return false;
    bucket.count += 1;
    return true;
  };
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function errorResponse(message: string) {
  return {
    jsonrpc: "2.0",
    error: { code: -32000, message },
    id: null
  };
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
