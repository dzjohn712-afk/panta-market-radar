export type ActiveMarketStatus = "primary" | "secondary";

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
  volumeUsdc: number;
}

export interface RadarCoverage {
  primaryPagesFetched: number;
  secondaryPagesFetched: number;
  primaryFetched: number;
  secondaryFetched: number;
  validAfterFiltering: number;
  candidatesSelected: number;
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
  markets: NormalizedCatalogMarket[];
  /** Present only in development; never part of the production API response. */
  diagnostics?: CatalogDiagnostics;
}
