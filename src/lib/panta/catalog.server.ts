import "server-only";
import { unstable_cache } from "next/cache";

import { getMarket, getMarketTrades, listMarkets } from "./client.server";
import { discoverActiveCatalog } from "./discovery";
import { discoverResolvedCatalog } from "./resolved-discovery";
import {
  activeWithPrices,
  buildPulse,
  inferResolvedOutcome,
  resolvedWithPrices,
  summarizeActivity,
  unavailableActivity,
} from "./insights";
import {
  selectCatalogCandidates,
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

async function buildRadarSnapshot(): Promise<RadarCatalogSnapshot> {
  const [discovery, resolvedDiscovery] = await Promise.all([
    discoverActiveCatalog((status, cursor) =>
      listMarkets({ status, limit: CATALOG_LIMIT_PER_PHASE, cursor }),
    ),
    discoverResolvedCatalog(listMarkets),
  ]);

  const candidates = selectCatalogCandidates(discovery.validMarkets, 20);
  const resolvedSelection = resolvedDiscovery.selected;
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
      resolved: resolvedDiscovery.coverage,
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

// Next's Data Cache is shared by page and Route Handler bundles, whereas
// module-local variables (and even globalThis in dev contexts) are not.
// unstable_cache hashes callback.toString() as well as keyParts. Production
// minifiers rename local identifiers differently in each bundle. A bound
// callback has a stable native-function string; the explicit versioned key
// identifies this builder across both bundles.
export const getRadarSnapshot = unstable_cache(
  buildRadarSnapshot.bind(null),
  ["panta-radar-snapshot-v21-shared", process.env.NODE_ENV ?? "unknown"],
  { revalidate: SNAPSHOT_TTL_MS / 1_000 },
);

export const radarSnapshotTtlSeconds = SNAPSHOT_TTL_MS / 1_000;
