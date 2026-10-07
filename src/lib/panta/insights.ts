import type {
  ActivitySummary,
  LiveMarketItem,
  MarketPrices,
  MarketPulse,
  NormalizedCatalogMarket,
  NormalizedResolvedMarket,
  PantaMarket,
  PantaTrade,
  ResolvedMarketItem,
  ResolvedOutcome,
} from "./types";

const OUTCOME_EPSILON = 0.02;

function probability(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
}

function pricePair(yes: unknown, no: unknown): [number, number] | null {
  const yesProbability = probability(yes);
  const noProbability = probability(no);
  return yesProbability === null || noProbability === null
    ? null
    : [yesProbability, noProbability];
}

export function pricesFromDetail(
  detail: PantaMarket | null,
  phase?: "primary" | "secondary" | "resolved",
): MarketPrices {
  if (!detail) {
    return { yesProbability: null, noProbability: null, priceUnavailable: true };
  }

  const pairs: Array<[unknown, unknown]> = [[detail.yesPrice, detail.noPrice]];
  if (phase === "primary") {
    pairs.push([detail.primaryYesPrice, detail.primaryNoPrice]);
  } else if (phase === "secondary") {
    pairs.push([detail.secondaryYesPrice, detail.secondaryNoPrice]);
  } else {
    pairs.push(
      [detail.secondaryYesPrice, detail.secondaryNoPrice],
      [detail.primaryYesPrice, detail.primaryNoPrice],
    );
  }

  for (const pair of pairs) {
    const parsed = pricePair(...pair);
    if (parsed) {
      return {
        yesProbability: parsed[0],
        noProbability: parsed[1],
        priceUnavailable: false,
      };
    }
  }

  return { yesProbability: null, noProbability: null, priceUnavailable: true };
}

export function summarizeActivity(
  trades: readonly PantaTrade[],
  nowSeconds = Math.floor(Date.now() / 1_000),
): ActivitySummary {
  const validTimes = trades
    .map((trade) => trade.blockTime)
    .filter((time): time is number => Number.isInteger(time) && Number(time) > 0);

  return {
    activityUnavailable: false,
    trades1h: validTimes.filter((time) => time >= nowSeconds - 3_600).length,
    trades24h: validTimes.filter((time) => time >= nowSeconds - 86_400).length,
    latestTradeTime: validTimes.length > 0 ? Math.max(...validTimes) : null,
    observedTradeCount: trades.length,
    mayBeTruncated: trades.length === 200,
  };
}

export function unavailableActivity(): ActivitySummary {
  return {
    activityUnavailable: true,
    trades1h: null,
    trades24h: null,
    latestTradeTime: null,
    observedTradeCount: null,
    mayBeTruncated: false,
  };
}

export function inferResolvedOutcome(prices: MarketPrices): ResolvedOutcome {
  if (prices.yesProbability === null || prices.noProbability === null) return "unknown";
  if (
    prices.yesProbability >= 1 - OUTCOME_EPSILON &&
    prices.noProbability <= OUTCOME_EPSILON
  ) {
    return "yes";
  }
  if (
    prices.yesProbability <= OUTCOME_EPSILON &&
    prices.noProbability >= 1 - OUTCOME_EPSILON
  ) {
    return "no";
  }
  return "unknown";
}

export function buildPulse(
  live: readonly LiveMarketItem[],
  resolved: readonly ResolvedMarketItem[],
): MarketPulse {
  const categories = new Set<string>();
  for (const item of live) categories.add(item.market.category);
  for (const item of resolved) categories.add(item.market.category);

  return {
    activeMarketsObserved: live.length,
    recentResolvedObserved: resolved.length,
    categoriesObserved: [...categories].sort(),
    activeVolumeObserved: live.reduce((total, item) => total + item.market.volumeUsdc, 0),
    resolvedVolumeObserved: resolved.reduce(
      (total, item) => total + item.market.volumeUsdc,
      0,
    ),
  };
}

export function activeWithPrices(
  market: NormalizedCatalogMarket,
  detail: PantaMarket | null,
): NormalizedCatalogMarket & MarketPrices {
  return { ...market, ...pricesFromDetail(detail, market.phase) };
}

export function resolvedWithPrices(
  market: NormalizedResolvedMarket,
  detail: PantaMarket | null,
): NormalizedResolvedMarket & MarketPrices {
  return { ...market, ...pricesFromDetail(detail, "resolved") };
}
