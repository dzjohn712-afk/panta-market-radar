import { analyzeCatalogMarkets } from "./normalize.ts";
import type {
  ActiveMarketStatus,
  CatalogDiagnostics,
  NormalizedCatalogMarket,
  PantaMarket,
  PantaMarketsResponse,
} from "./types";

const PHASES: readonly ActiveMarketStatus[] = ["primary", "secondary"];

interface PhaseState {
  rows: PantaMarket[];
  pagesFetched: number;
  cursor: string | null;
  finished: boolean;
}

export interface CatalogDiscoveryResult {
  primaryRows: PantaMarket[];
  secondaryRows: PantaMarket[];
  primaryPagesFetched: number;
  secondaryPagesFetched: number;
  validMarkets: NormalizedCatalogMarket[];
  diagnostics: CatalogDiagnostics;
}

export type FetchCatalogPage = (
  status: ActiveMarketStatus,
  cursor?: string,
) => Promise<PantaMarketsResponse>;

function nextCursor(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Fetches both lifecycle catalogs in bounded rounds, never over six requests. */
export async function discoverActiveCatalog(
  fetchPage: FetchCatalogPage,
  options: {
    maxPagesPerPhase?: number;
    candidateCap?: number;
    nowSeconds?: number;
  } = {},
): Promise<CatalogDiscoveryResult> {
  const maxPagesPerPhase = options.maxPagesPerPhase ?? 3;
  const candidateCap = options.candidateCap ?? 20;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1_000);

  if (!Number.isInteger(maxPagesPerPhase) || maxPagesPerPhase < 1 || maxPagesPerPhase > 3) {
    throw new RangeError("maxPagesPerPhase must be an integer between 1 and 3");
  }
  if (!Number.isInteger(candidateCap) || candidateCap < 1 || candidateCap > 20) {
    throw new RangeError("candidateCap must be an integer between 1 and 20");
  }

  const states: Record<ActiveMarketStatus, PhaseState> = {
    primary: { rows: [], pagesFetched: 0, cursor: null, finished: false },
    secondary: { rows: [], pagesFetched: 0, cursor: null, finished: false },
  };

  let analysis = analyzeCatalogMarkets([], nowSeconds);

  while (analysis.markets.length < candidateCap) {
    const activePhases = PHASES.filter((phase) => {
      const state = states[phase];
      return !state.finished && state.pagesFetched < maxPagesPerPhase;
    });
    if (activePhases.length === 0) break;

    const pages = await Promise.all(
      activePhases.map(async (phase) => ({
        phase,
        page: await fetchPage(phase, states[phase].cursor ?? undefined),
      })),
    );

    for (const { phase, page } of pages) {
      const state = states[phase];
      const previousCursor = state.cursor;
      state.rows.push(...page.items);
      state.pagesFetched += 1;
      state.cursor = nextCursor(page.nextCursor);
      state.finished =
        state.cursor === null ||
        state.cursor === previousCursor ||
        state.pagesFetched >= maxPagesPerPhase;
    }

    analysis = analyzeCatalogMarkets(
      [...states.primary.rows, ...states.secondary.rows],
      nowSeconds,
    );
  }

  return {
    primaryRows: states.primary.rows,
    secondaryRows: states.secondary.rows,
    primaryPagesFetched: states.primary.pagesFetched,
    secondaryPagesFetched: states.secondary.pagesFetched,
    validMarkets: analysis.markets,
    diagnostics: analysis.diagnostics,
  };
}
