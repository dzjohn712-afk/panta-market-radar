import "server-only";

import { getMarket, getMarketTrades, listMarkets } from "./client.server";
import { discoverActiveCatalog } from "./discovery";
import {
  activeWithPrices,
  buildPulse,
  inferResolvedOutcome,
  resolvedWithPrices,
  summarizeActivity,
  unavailableActivity,
} from "./insights";
import {
  normalizeResolvedMarkets,
  selectCatalogCandidates,
  selectRecentlyResolved,
} from "./normalize";
import type {
  LiveMarketItem,
  NormalizedCatalogMarket,
  NormalizedResolvedMarket,
  RadarCatalogSnapshot,
  ResolvedMarketItem,
} from "./types";

const CATALOG_LIMIT_PER_PHASE = 50;
const SNAPSHOT_TTL_MS = 150_000;

let cachedSnapshot: RadarCatalogSnapshot | null = null;
let cachedUntil = 0;
let pendingSnapshot: Promise<RadarCatalogSnapshot> | null = null;

async function enrichLiveMarket(
  market: NormalizedCatalogMarket,
  nowSeconds: number,
): Promise<LiveMarketItem> {
  const [detailResult, tradesResult] = await Promise.allSettled([
    getMarket(market.marketId),
    getMarketTrades(market.marketId, 200),
  ]);

  return {
    market: activeWithPrices(
      market,
      detailResult.status === "fulfilled" ? detailResult.value : null,
    ),
    activity:
      tradesResult.status === "fulfilled"
        ? summarizeActivity(tradesResult.value.items, nowSeconds)
        : unavailableActivity(),
  };
}

async function enrichResolvedMarket(
  market: NormalizedResolvedMarket,
): Promise<ResolvedMarketItem> {
  const [detailResult] = await Promise.allSettled([getMarket(market.marketId)]);
  const enrichedMarket = resolvedWithPrices(
    market,
    detailResult.status === "fulfilled" ? detailResult.value : null,
  );

  return {
    market: enrichedMarket,
    outcome: inferResolvedOutcome(enrichedMarket),
  };
}

async function buildRadarCatalogSnapshot(): Promise<RadarCatalogSnapshot> {
  const [discovery, resolvedPage] = await Promise.all([
    discoverActiveCatalog((status, cursor) =>
      listMarkets({ status, limit: CATALOG_LIMIT_PER_PHASE, cursor }),
    ),
    listMarkets({ status: "resolved", limit: 50 }),
  ]);

  const candidates = selectCatalogCandidates(discovery.validMarkets, 20);
  const validResolved = normalizeResolvedMarkets(resolvedPage.items);
  const resolvedSelection = selectRecentlyResolved(validResolved, 10);
  const nowSeconds = Math.floor(Date.now() / 1_000);

  const [live, recentlyResolved] = await Promise.all([
    Promise.all(candidates.map((market) => enrichLiveMarket(market, nowSeconds))),
    Promise.all(resolvedSelection.map(enrichResolvedMarket)),
  ]);

  const snapshot: RadarCatalogSnapshot = {
    generatedAt: new Date().toISOString(),
    coverage: {
      active: {
        primaryPagesFetched: discovery.primaryPagesFetched,
        secondaryPagesFetched: discovery.secondaryPagesFetched,
        primaryFetched: discovery.primaryRows.length,
        secondaryFetched: discovery.secondaryRows.length,
        rawRows: discovery.primaryRows.length + discovery.secondaryRows.length,
        validMarkets: discovery.validMarkets.length,
        candidatesSelected: candidates.length,
      },
      resolved: {
        rowsFetched: resolvedPage.items.length,
        validMarkets: validResolved.length,
        marketsSelected: resolvedSelection.length,
      },
    },
    live,
    recentlyResolved,
    pulse: buildPulse(live, recentlyResolved),
  };

  if (process.env.NODE_ENV === "development") {
    snapshot.diagnostics = { active: discovery.diagnostics };
    console.info(
      "[panta-radar] catalog diagnostics (rejection counters overlap)",
      discovery.diagnostics,
    );
  }

  return snapshot;
}

export async function getRadarCatalogSnapshot(): Promise<RadarCatalogSnapshot> {
  const now = Date.now();
  if (cachedSnapshot && now < cachedUntil) return cachedSnapshot;
  if (pendingSnapshot) return pendingSnapshot;

  pendingSnapshot = buildRadarCatalogSnapshot()
    .then((snapshot) => {
      cachedSnapshot = snapshot;
      cachedUntil = Date.now() + SNAPSHOT_TTL_MS;
      return snapshot;
    })
    .finally(() => {
      pendingSnapshot = null;
    });

  return pendingSnapshot;
}

export const radarSnapshotTtlSeconds = SNAPSHOT_TTL_MS / 1_000;
