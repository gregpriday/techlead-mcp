import { randomUUID } from "node:crypto";

export type Trace = {
  traceId: string;
  startedAt: string;
  events: Array<{ at: string; name: string; data?: Record<string, unknown> }>;
};

export function createTrace(): Trace {
  return {
    traceId: randomUUID(),
    startedAt: new Date().toISOString(),
    events: []
  };
}

export function addTraceEvent(trace: Trace, name: string, data?: Record<string, unknown>): void {
  trace.events.push({ at: new Date().toISOString(), name, data });
}
