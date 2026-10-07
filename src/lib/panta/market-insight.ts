import { normalizeMarketDetail } from "./normalize.ts";
import { inferResolvedOutcome, summarizeActivity, unavailableActivity } from "./insights.ts";
import type { MarketInsight, PantaTrade, ResolvedMarketItem, ResolvedOutcome } from "./types";

export function buildMarketInsight(
  detail: unknown,
  trades: readonly PantaTrade[] | null,
  nowSeconds = Math.floor(Date.now() / 1_000),
): MarketInsight | null {
  const market = normalizeMarketDetail(detail, nowSeconds);
  if (!market) return null;
  const outcome = market.isResolved ? inferResolvedOutcome(market) : "unknown";
  return {
    generatedAt: new Date(nowSeconds * 1_000).toISOString(), market,
    state: market.isActive ? "live" : market.isResolved
      ? outcome === "unknown" ? "resolution-unknown" : `resolved-${outcome}` : "inactive",
    activity: market.isActive ? trades === null ? unavailableActivity() : summarizeActivity(trades, nowSeconds) : null,
  };
}

export function filterResolvedMarkets(
  markets: readonly ResolvedMarketItem[],
  category = "all",
  outcome: ResolvedOutcome | "all" = "all",
): ResolvedMarketItem[] {
  return markets.filter((item) =>
    (category === "all" || item.market.category === category) &&
    (outcome === "all" || item.outcome === outcome),
  );
}
