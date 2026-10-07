import type {
  ActiveMarketStatus,
  NormalizedCatalogMarket,
  PantaMarket,
} from "./types";

const MARKET_ID_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;
const ACTIVE_PHASES = new Set<ActiveMarketStatus>(["primary", "secondary"]);
const EXCLUDED_STATUSES = new Set(["resolved", "cancelled", "canceled"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalTimestamp(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function nonNegativeNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function normalizeCatalogMarket(
  value: unknown,
  nowSeconds = Math.floor(Date.now() / 1_000),
): NormalizedCatalogMarket | null {
  const row = asRecord(value);
  if (!row) return null;

  const marketId = optionalString(row.marketId);
  const title = optionalString(row.title);
  const category = optionalString(row.category);
  const rawPhase = optionalString(row.phase)?.toLowerCase();
  const status = optionalString(row.status)?.toLowerCase();
  const endTime = optionalTimestamp(row.endTime);

  if (!marketId || !MARKET_ID_PATTERN.test(marketId)) return null;
  if (!title || !category) return null;
  if (!rawPhase || !ACTIVE_PHASES.has(rawPhase as ActiveMarketStatus)) return null;
  if (row.resolved === true || (status && EXCLUDED_STATUSES.has(status))) return null;
  if (!endTime || endTime <= nowSeconds) return null;

  return {
    marketId,
    category: category.toLowerCase(),
    title,
    description: optionalString(row.description),
    phase: rawPhase as ActiveMarketStatus,
    marketType: optionalString(row.marketType),
    startTime: optionalTimestamp(row.startTime),
    endTime,
    resolutionTime: optionalTimestamp(row.resolutionTime),
    region: optionalString(row.region),
    volumeUsdc: nonNegativeNumber(row.volumeUsdc),
  };
}

export function normalizeAndDeduplicateMarkets(
  rows: readonly PantaMarket[] | readonly unknown[],
  nowSeconds = Math.floor(Date.now() / 1_000),
): NormalizedCatalogMarket[] {
  const byId = new Map<string, NormalizedCatalogMarket>();

  for (const row of rows) {
    const market = normalizeCatalogMarket(row, nowSeconds);
    if (!market) continue;

    const existing = byId.get(market.marketId);
    if (
      !existing ||
      (existing.phase === "primary" && market.phase === "secondary") ||
      (existing.phase === market.phase && market.volumeUsdc > existing.volumeUsdc)
    ) {
      byId.set(market.marketId, market);
    }
  }

  return [...byId.values()];
}

function byVolumeThenClose(a: NormalizedCatalogMarket, b: NormalizedCatalogMarket): number {
  return b.volumeUsdc - a.volumeUsdc || a.endTime - b.endTime || a.marketId.localeCompare(b.marketId);
}

function byCloseThenVolume(a: NormalizedCatalogMarket, b: NormalizedCatalogMarket): number {
  return a.endTime - b.endTime || b.volumeUsdc - a.volumeUsdc || a.marketId.localeCompare(b.marketId);
}

/**
 * Catalog-only shortlist, deliberately separate from the future Radar Score.
 * It reserves room for high-volume, closing-soon, and crypto markets, then
 * fills any overlap-created gaps by volume.
 */
export function selectCatalogCandidates(
  markets: readonly NormalizedCatalogMarket[],
  limit = 20,
): NormalizedCatalogMarket[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new RangeError("candidate limit must be an integer between 1 and 20");
  }

  const selected = new Map<string, NormalizedCatalogMarket>();
  const add = (rows: readonly NormalizedCatalogMarket[], count: number) => {
    for (const market of rows.slice(0, count)) {
      if (selected.size >= limit) break;
      selected.set(market.marketId, market);
    }
  };

  add([...markets].sort(byVolumeThenClose), Math.min(8, limit));
  add([...markets].sort(byCloseThenVolume), Math.min(6, limit));
  add(
    markets.filter((market) => market.category === "crypto").sort(byVolumeThenClose),
    Math.min(6, limit),
  );
  add([...markets].sort(byVolumeThenClose), limit);

  return [...selected.values()].slice(0, limit);
}
