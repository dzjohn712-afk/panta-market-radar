export type ActiveMarketStatus = "primary" | "secondary";
export type MarketListStatus = ActiveMarketStatus | "resolved";

/** Documented GET /markets/ and GET /markets/{marketId}/ response fields. */
export interface PantaMarket {
  marketId: string;
  category: string;
  title: string;
  description?: string;
  images?: string[];
  phase: string;
  marketType?: string;
  startTime?: number | null;
  endTime?: number | null;
  resolutionTime?: number | null;
  region?: string;
  resolved?: boolean;
  status?: string;
  volumeUsdc?: string | number | null;
  campaignId?: string | null;
  createdByPartner?: boolean;
  yesPrice?: string | number | null;
  noPrice?: string | number | null;
  primaryYesPrice?: string | number | null;
  primaryNoPrice?: string | number | null;
  secondaryYesPrice?: string | number | null;
  secondaryNoPrice?: string | number | null;

  /** Observed in live responses but not part of the documented contract. */
  totalVolumeUsdc?: string | number | null;
  priceSource?: string | null;
  valuationStatus?: string | null;
}

export interface PantaMarketsResponse {
  items: PantaMarket[];
  nextCursor?: string | null;
}

/** Documented GET /markets/{marketId}/trades/ row. */
export interface PantaTrade {
  id?: string | number;
  marketId?: string;
  wallet?: string;
  isPrimary?: boolean;
  yesAmount?: string | number;
  noAmount?: string | number;
  feePaid?: string | number;
  blockTime?: number | null;
  signature?: string;
  quoteAsset?: string;
}

export interface PantaTradesResponse {
  marketId: string;
  items: PantaTrade[];
}

/** Safe catalog-only representation. List prices are intentionally omitted. */
export interface NormalizedCatalogMarket {
  marketId: string;
  category: string;
  title: string;
  description: string | null;
  phase: ActiveMarketStatus;
  marketType: string | null;
  startTime: number | null;
  endTime: number;
  resolutionTime: number | null;
  region: string | null;
  volumeUsdc: number | null;
}

export interface NormalizedResolvedMarket {
  marketId: string;
  category: string;
  title: string;
  description: string | null;
  phase: "resolved";
  marketType: string | null;
  endTime: number | null;
  resolutionTime: number | null;
  region: string | null;
  volumeUsdc: number | null;
}

export interface MarketPrices {
  yesProbability: number | null;
  noProbability: number | null;
  priceUnavailable: boolean;
}

export interface ActivityAvailable {
  activityUnavailable: false;
  trades1h: number;
  trades24h: number;
  latestTradeTime: number | null;
  observedTradeCount: number;
  mayBeTruncated: boolean;
}

export interface ActivityUnavailable {
  activityUnavailable: true;
  trades1h: null;
  trades24h: null;
  latestTradeTime: null;
  observedTradeCount: null;
  mayBeTruncated: false;
}

export type ActivitySummary = ActivityAvailable | ActivityUnavailable;

export interface LiveMarketItem {
  market: NormalizedCatalogMarket & MarketPrices;
  activity: ActivitySummary;
}

export type ResolvedOutcome = "yes" | "no" | "unknown";

export interface ResolvedMarketItem {
  market: NormalizedResolvedMarket & MarketPrices;
  outcome: ResolvedOutcome;
}

export interface MarketPulse {
  activeMarketsObserved: number;
  recentResolvedObserved: number;
  categoriesObserved: string[];
  activeVolumeObserved: number | null;
  resolvedVolumeObserved: number | null;
}

export interface ActiveCoverage {
  primaryPagesFetched: number;
  secondaryPagesFetched: number;
  primaryFetched: number;
  secondaryFetched: number;
  rawRows: number;
  validMarkets: number;
  candidatesSelected: number;
}

export interface ResolvedCoverage {
  rowsFetched: number;
  filteredRowsFetched: number;
  fallbackPagesFetched: number;
  validMarkets: number;
  marketsSelected: number;
}

export interface RadarCoverage {
  active: ActiveCoverage;
  resolved: ResolvedCoverage;
}

export interface CatalogDiagnostics {
  totalRawRows: number;
  emptyTitleRows: number;
  expiredRows: number;
  resolvedCancelledRows: number;
  malformedIdRows: number;
  malformedEndTimeRows: number;
  invalidLifecycleRows: number;
  missingCategoryRows: number;
  duplicateRows: number;
  conflictingDuplicateRows: number;
  finalValidRows: number;
}

export interface RadarCatalogSnapshot {
  generatedAt: string;
  coverage: RadarCoverage;
  live: LiveMarketItem[];
  recentlyResolved: ResolvedMarketItem[];
  pulse: MarketPulse;
  /** Present only in development; never part of the production API response. */
  diagnostics?: {
    active: CatalogDiagnostics;
  };
}
