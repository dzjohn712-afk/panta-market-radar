import { discoverActiveCatalog } from "./discovery.ts";
import { discoverResolvedCatalog } from "./resolved-discovery.ts";
import { mapConcurrent } from "./coordination.ts";
import { activeWithPrices, buildPulse, hasLifecycleConflict, inferResolvedOutcome,
  resolvedWithPrices, summarizeActivity, unavailableActivity } from "./insights.ts";
import { selectCatalogCandidates } from "./normalize.ts";
import type { LiveMarketItem, MarketListStatus, NormalizedCatalogMarket, PantaMarket,
  PantaMarketsResponse, PantaTradesResponse, RadarCatalogSnapshot, ResolvedMarketItem } from "./types";

export interface RadarClient {
  listMarkets(options: {status?: MarketListStatus; limit?: number; cursor?: string}): Promise<PantaMarketsResponse>;
  getMarket(marketId: string): Promise<PantaMarket>;
  getMarketTrades(marketId: string, limit: number): Promise<PantaTradesResponse>;
}

export async function enrichLiveCandidate(
  market: NormalizedCatalogMarket, client: RadarClient, nowSeconds: number,
): Promise<LiveMarketItem | null> {
  const [detail, trades] = await Promise.allSettled([
    client.getMarket(market.marketId), client.getMarketTrades(market.marketId, 200),
  ]);
  if (detail.status === "fulfilled" && hasLifecycleConflict(detail.value)) return null;
  return {
    market: activeWithPrices(market, detail.status === "fulfilled" ? detail.value : null),
    activity: trades.status === "fulfilled" ? summarizeActivity(trades.value.items, nowSeconds) : unavailableActivity(),
  };
}

/** Dependencies are injected only to test orchestration without server credentials. */
export async function loadRadarSnapshot(
  client: RadarClient, development = false, now: () => number = Date.now,
): Promise<RadarCatalogSnapshot> {
  const [active, resolved] = await Promise.all([
    discoverActiveCatalog((status, cursor) => client.listMarkets({status, cursor, limit:50})),
    discoverResolvedCatalog((options) => client.listMarkets(options)).catch(() => null),
  ]);
  const candidates = selectCatalogCandidates(active.validMarkets, 20);
  const nowSeconds = Math.floor(now() / 1_000);
  // A single pool covers BOTH sections: at most five markets and ten HTTP
  // requests in flight during enrichment (active markets have two requests).
  const jobs: Array<() => Promise<{live:LiveMarketItem | null} | {resolved:ResolvedMarketItem}>> = [
    ...candidates.map((market) => async () => ({live: await enrichLiveCandidate(market, client, nowSeconds)})),
    ...(resolved?.selected ?? []).map((market) => async () => {
      const detail = await client.getMarket(market.marketId).catch(() => null);
      const enriched = resolvedWithPrices(market, detail);
      return {resolved: {market:enriched, outcome:inferResolvedOutcome(enriched)}};
    }),
  ];
  const enriched = await mapConcurrent(jobs, 5, (job) => job());
  const live: LiveMarketItem[] = [];
  const recentlyResolved: RadarCatalogSnapshot["recentlyResolved"] = [];
  let lifecycleConflicts = 0;
  for (const result of enriched) {
    if ("live" in result) {
      if (result.live) live.push(result.live);
      else lifecycleConflicts += 1;
    } else recentlyResolved.push(result.resolved);
  }
  return {
    generatedAt: new Date(nowSeconds * 1_000).toISOString(),
    coverage: {
      active: {primaryPagesFetched:active.primaryPagesFetched, secondaryPagesFetched:active.secondaryPagesFetched,
        primaryFetched:active.primaryRows.length, secondaryFetched:active.secondaryRows.length,
        rawRows:active.primaryRows.length + active.secondaryRows.length,
        validMarkets:active.validMarkets.length, candidatesSelected:candidates.length},
      resolved: resolved ? {available:true, ...resolved.coverage} : {
        available:false, rowsFetched:null, filteredRowsFetched:null, fallbackPagesFetched:null,
        validMarkets:null, marketsSelected:null,
      },
    },
    live, recentlyResolved, pulse:buildPulse(live, recentlyResolved, resolved !== null),
    ...(development ? {diagnostics:{active:active.diagnostics, lifecycleConflicts}} : {}),
  };
}
