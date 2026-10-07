import "server-only";

import type {
  MarketListStatus,
  PantaMarket,
  PantaMarketsResponse,
  PantaTradesResponse,
} from "./types";

const DEFAULT_TIMEOUT_MS = 8_000;
const MARKET_ID_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;

interface PantaConfig {
  apiBaseUrl: string;
  apiKey: string;
}

export class PantaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "PantaApiError";
  }
}

function getConfig(): PantaConfig {
  const rawBaseUrl = process.env.PANTA_API_BASE_URL?.trim();
  const apiKey = process.env.PANTA_API_KEY?.trim();

  if (!rawBaseUrl || !apiKey) {
    throw new PantaApiError(
      "Panta API environment configuration is missing",
      500,
      "PANTA_CONFIG_MISSING",
    );
  }

  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    throw new PantaApiError(
      "PANTA_API_BASE_URL is invalid",
      500,
      "PANTA_CONFIG_INVALID",
    );
  }

  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new PantaApiError(
      "PANTA_API_BASE_URL must be a fixed HTTP(S) origin and path",
      500,
      "PANTA_CONFIG_INVALID",
    );
  }

  return {
    apiBaseUrl: url.toString().replace(/\/$/, ""),
    apiKey,
  };
}

export function validateLimit(limit: number, max: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > max) {
    throw new RangeError(`limit must be an integer between 1 and ${max}`);
  }
  return limit;
}

export function validateMarketId(marketId: string): string {
  const normalized = marketId.trim();
  if (!MARKET_ID_PATTERN.test(normalized)) {
    throw new TypeError("marketId must be a valid base58 identifier");
  }
  return normalized;
}

function readErrorCode(body: unknown): string {
  if (typeof body === "object" && body !== null && "code" in body) {
    const code = (body as { code?: unknown }).code;
    if (typeof code === "string" && code.length <= 100) return code;
  }
  return "PANTA_REQUEST_FAILED";
}

async function pantaGet<T>(path: string, query?: URLSearchParams): Promise<T> {
  const config = getConfig();
  const url = new URL(`${config.apiBaseUrl}/${path.replace(/^\/+|\/+$/g, "")}/`);
  if (query) url.search = query.toString();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": config.apiKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new PantaApiError(
      timedOut ? "Panta API request timed out" : "Panta API is unreachable",
      502,
      timedOut ? "PANTA_TIMEOUT" : "PANTA_UNREACHABLE",
    );
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new PantaApiError(
      "Panta API request failed",
      response.status,
      readErrorCode(body),
      Number.isFinite(retryAfter) ? retryAfter : null,
    );
  }

  return body as T;
}

export async function listMarkets(options: {
  status: MarketListStatus;
  limit?: number;
  category?: string;
  cursor?: string;
}): Promise<PantaMarketsResponse> {
  const limit = validateLimit(options.limit ?? 20, 50);
  const query = new URLSearchParams({ status: options.status, limit: String(limit) });
  if (options.category?.trim()) query.set("category", options.category.trim());
  if (options.cursor?.trim()) query.set("cursor", options.cursor.trim());

  const response = await pantaGet<unknown>("markets", query);
  if (
    typeof response !== "object" ||
    response === null ||
    !("items" in response) ||
    !Array.isArray((response as { items?: unknown }).items)
  ) {
    throw new PantaApiError("Panta returned an invalid market list", 502, "PANTA_INVALID_RESPONSE");
  }
  return response as PantaMarketsResponse;
}

export async function getMarket(marketId: string): Promise<PantaMarket> {
  const response = await pantaGet<unknown>(`markets/${validateMarketId(marketId)}`);
  if (typeof response !== "object" || response === null || Array.isArray(response)) {
    throw new PantaApiError("Panta returned an invalid market detail", 502, "PANTA_INVALID_RESPONSE");
  }
  return response as PantaMarket;
}

export async function getMarketTrades(
  marketId: string,
  limit = 50,
): Promise<PantaTradesResponse> {
  const query = new URLSearchParams({ limit: String(validateLimit(limit, 200)) });
  const response = await pantaGet<unknown>(
    `markets/${validateMarketId(marketId)}/trades`,
    query,
  );
  if (
    typeof response !== "object" ||
    response === null ||
    !("items" in response) ||
    !Array.isArray((response as { items?: unknown }).items)
  ) {
    throw new PantaApiError("Panta returned an invalid trade list", 502, "PANTA_INVALID_RESPONSE");
  }
  return response as PantaTradesResponse;
}
