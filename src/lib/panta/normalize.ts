import type {
  ActiveMarketStatus,
  CatalogDiagnostics,
  NormalizedCatalogMarket,
  NormalizedResolvedMarket,
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

function nonNegativeNumber(value: unknown): number | null {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(number) && number >= 0 ? number : null;
}

interface MarketInspection {
  market: NormalizedCatalogMarket | null;
  emptyTitle: boolean;
  expired: boolean;
  resolvedCancelled: boolean;
  malformedId: boolean;
  malformedEndTime: boolean;
  invalidLifecycle: boolean;
  missingCategory: boolean;
}

function inspectCatalogMarket(value: unknown, nowSeconds: number): MarketInspection {
  const row = asRecord(value);
  const marketId = row ? optionalString(row.marketId) : null;
  const title = row ? optionalString(row.title) : null;
  const category = row ? optionalString(row.category) : null;
  const rawPhase = row ? optionalString(row.phase)?.toLowerCase() : null;
  const status = row ? optionalString(row.status)?.toLowerCase() : null;
  const endTime = row ? optionalTimestamp(row.endTime) : null;

  const malformedId = !marketId || !MARKET_ID_PATTERN.test(marketId);
  const emptyTitle = !title;
  const missingCategory = !category;
  const phaseIsResolvedCancelled = Boolean(rawPhase && EXCLUDED_STATUSES.has(rawPhase));
  const resolvedCancelled = Boolean(
    row?.resolved === true ||
      (status && EXCLUDED_STATUSES.has(status)) ||
      phaseIsResolvedCancelled,
  );
  const invalidLifecycle = Boolean(
    !rawPhase ||
      (!ACTIVE_PHASES.has(rawPhase as ActiveMarketStatus) && !phaseIsResolvedCancelled),
  );
  const malformedEndTime = endTime === null;
  const expired = endTime !== null && endTime <= nowSeconds;

  const rejected =
    malformedId ||
    emptyTitle ||
    missingCategory ||
    resolvedCancelled ||
    invalidLifecycle ||
    malformedEndTime ||
    expired;

  return {
    market:
      !row || rejected || !marketId || !title || !category || !rawPhase || !endTime
        ? null
        : {
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
          },
    emptyTitle,
    expired,
    resolvedCancelled,
    malformedId,
    malformedEndTime,
    invalidLifecycle,
    missingCategory,
  };
}

export function normalizeCatalogMarket(
  value: unknown,
  nowSeconds = Math.floor(Date.now() / 1_000),
): NormalizedCatalogMarket | null {
  return inspectCatalogMarket(value, nowSeconds).market;
}

export function analyzeCatalogMarkets(
  rows: readonly PantaMarket[] | readonly unknown[],
  nowSeconds = Math.floor(Date.now() / 1_000),
): { markets: NormalizedCatalogMarket[]; diagnostics: CatalogDiagnostics } {
  const byId = new Map<string, NormalizedCatalogMarket>();
  const diagnostics: CatalogDiagnostics = {
    totalRawRows: rows.length,
    emptyTitleRows: 0,
    expiredRows: 0,
    resolvedCancelledRows: 0,
    malformedIdRows: 0,
    malformedEndTimeRows: 0,
    invalidLifecycleRows: 0,
    missingCategoryRows: 0,
    duplicateRows: 0,
    conflictingDuplicateRows: 0,
    finalValidRows: 0,
  };

  for (const row of rows) {
    const inspection = inspectCatalogMarket(row, nowSeconds);
    if (inspection.emptyTitle) diagnostics.emptyTitleRows += 1;
    if (inspection.expired) diagnostics.expiredRows += 1;
    if (inspection.resolvedCancelled) diagnostics.resolvedCancelledRows += 1;
    if (inspection.malformedId) diagnostics.malformedIdRows += 1;
    if (inspection.malformedEndTime) diagnostics.malformedEndTimeRows += 1;
    if (inspection.invalidLifecycle) diagnostics.invalidLifecycleRows += 1;
    if (inspection.missingCategory) diagnostics.missingCategoryRows += 1;

    const market = inspection.market;
    if (!market) continue;

    const existing = byId.get(market.marketId);
    if (existing) {
      diagnostics.duplicateRows += 1;
      if (catalogMarketsConflict(existing, market)) {
        diagnostics.conflictingDuplicateRows += 1;
      }
    }
    if (
      !existing ||
      (existing.phase === "primary" && market.phase === "secondary") ||
      (existing.phase === market.phase && (market.volumeUsdc ?? -1) > (existing.volumeUsdc ?? -1))
    ) {
      byId.set(market.marketId, market);
    }
  }

  const markets = [...byId.values()];
  diagnostics.finalValidRows = markets.length;
  return { markets, diagnostics };
}

function catalogMarketsConflict(
  left: NormalizedCatalogMarket,
  right: NormalizedCatalogMarket,
): boolean {
  return (
    left.category !== right.category ||
    left.title !== right.title ||
    left.description !== right.description ||
    left.phase !== right.phase ||
    left.marketType !== right.marketType ||
    left.startTime !== right.startTime ||
    left.endTime !== right.endTime ||
    left.resolutionTime !== right.resolutionTime ||
    left.region !== right.region ||
    left.volumeUsdc !== right.volumeUsdc
  );
}

export function normalizeAndDeduplicateMarkets(
  rows: readonly PantaMarket[] | readonly unknown[],
  nowSeconds = Math.floor(Date.now() / 1_000),
): NormalizedCatalogMarket[] {
  return analyzeCatalogMarkets(rows, nowSeconds).markets;
}

export function normalizeResolvedMarkets(
  rows: readonly PantaMarket[] | readonly unknown[],
): NormalizedResolvedMarket[] {
  const byId = new Map<string, NormalizedResolvedMarket>();

  for (const value of rows) {
    const row = asRecord(value);
    if (!row) continue;

    const marketId = optionalString(row.marketId);
    const title = optionalString(row.title);
    const phase = optionalString(row.phase)?.toLowerCase();
    const status = optionalString(row.status)?.toLowerCase();
    const isResolved = row.resolved === true || phase === "resolved" || status === "resolved";
    const hasResolutionTime =
      row.resolutionTime !== undefined &&
      row.resolutionTime !== null &&
      row.resolutionTime !== "";
    const resolutionTime = optionalTimestamp(row.resolutionTime);

    if (!marketId || !MARKET_ID_PATTERN.test(marketId) || !title || !isResolved) continue;
    if (hasResolutionTime && resolutionTime === null) continue;

    const market: NormalizedResolvedMarket = {
      marketId,
      category: optionalString(row.category)?.toLowerCase() ?? "other",
      title,
      description: optionalString(row.description),
      phase: "resolved",
      marketType: optionalString(row.marketType),
      endTime: optionalTimestamp(row.endTime),
      resolutionTime,
      region: optionalString(row.region),
      volumeUsdc: nonNegativeNumber(row.volumeUsdc),
    };

    const existing = byId.get(marketId);
    if (
      !existing ||
      (market.resolutionTime ?? -1) > (existing.resolutionTime ?? -1)
    ) {
      byId.set(marketId, market);
    }
  }

  return [...byId.values()]
    .sort(
      (left, right) =>
        (right.resolutionTime ?? -1) - (left.resolutionTime ?? -1) ||
        left.marketId.localeCompare(right.marketId),
    );
}

export function selectRecentlyResolved(
  markets: readonly NormalizedResolvedMarket[],
  limit = 10,
): NormalizedResolvedMarket[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
    throw new RangeError("resolved market limit must be an integer between 1 and 10");
  }
  return [...markets]
    .sort(
      (left, right) =>
        (right.resolutionTime ?? -1) - (left.resolutionTime ?? -1) ||
        left.marketId.localeCompare(right.marketId),
    )
    .slice(0, limit);
}

function byVolumeThenClose(a: NormalizedCatalogMarket, b: NormalizedCatalogMarket): number {
  return (b.volumeUsdc ?? -1) - (a.volumeUsdc ?? -1) || a.endTime - b.endTime || a.marketId.localeCompare(b.marketId);
}

function byCloseThenVolume(a: NormalizedCatalogMarket, b: NormalizedCatalogMarket): number {
  return a.endTime - b.endTime || (b.volumeUsdc ?? -1) - (a.volumeUsdc ?? -1) || a.marketId.localeCompare(b.marketId);
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
