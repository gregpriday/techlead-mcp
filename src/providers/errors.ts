import type { ProviderId } from "../types.js";

export class ProviderUnavailableError extends Error {
  constructor(
    public readonly provider: ProviderId,
    message: string
  ) {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

export class ProviderCallError extends Error {
  constructor(
    public readonly provider: ProviderId,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ProviderCallError";
  }
}

export class ProviderOutputParseError extends Error {
  constructor(
    public readonly provider: ProviderId,
    message: string,
    public readonly rawText: string
  ) {
    super(message);
    this.name = "ProviderOutputParseError";
  }
}
