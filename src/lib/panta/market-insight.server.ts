import "server-only";
import { unstable_cache } from "next/cache";
import { getMarket, getMarketTrades, PantaApiError, validateMarketId } from "./client.server";
import { buildMarketInsight } from "./market-insight";

async function loadMarketInsight(marketId: string) {
  const detail = await getMarket(marketId);
  const nowSeconds = Math.floor(Date.now() / 1_000);
  const insight = buildMarketInsight(detail, null, nowSeconds);
  if (!insight || insight.market.marketId !== marketId) {
    throw new PantaApiError("Market metadata unavailable", 404, "MARKET_NOT_FOUND");
  }
  if (!insight.market.isActive) return insight;
  try {
    const trades = await getMarketTrades(marketId, 200);
    return buildMarketInsight(detail, trades.items, nowSeconds)!;
  } catch {
    return insight;
  }
}

const cachedMarketInsight = unstable_cache(loadMarketInsight.bind(null),
  ["panta-market-insight-v3", process.env.NODE_ENV ?? "unknown"], { revalidate: 150 });

export async function getMarketInsight(marketId: string) {
  return cachedMarketInsight(validateMarketId(marketId));
}
