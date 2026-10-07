import { normalizeResolvedMarkets, selectRecentlyResolved } from "./normalize.ts";
import type { PantaMarket, PantaMarketsResponse } from "./types";

type FetchPage = (options: {
  status?: "resolved";
  limit: number;
  cursor?: string;
}) => Promise<PantaMarketsResponse>;

export async function discoverResolvedCatalog(fetchPage: FetchPage) {
  const filtered = await fetchPage({ status: "resolved", limit: 50 });
  const rows: PantaMarket[] = [...filtered.items];
  let validMarkets = normalizeResolvedMarkets(rows);
  let fallbackPagesFetched = 0;

  if (validMarkets.length === 0) {
    let cursor: string | undefined;
    for (let pageNumber = 0; pageNumber < 2; pageNumber += 1) {
      const page = await fetchPage({ limit: 50, ...(cursor ? { cursor } : {}) });
      rows.push(...page.items);
      fallbackPagesFetched += 1;
      validMarkets = normalizeResolvedMarkets(rows);
      const next = typeof page.nextCursor === "string" ? page.nextCursor.trim() : "";
      if (!next || next === cursor || validMarkets.length >= 10) break;
      cursor = next;
    }
  }

  return {
    selected: selectRecentlyResolved(validMarkets),
    coverage: {
      rowsFetched: rows.length,
      filteredRowsFetched: filtered.items.length,
      fallbackPagesFetched,
      validMarkets: validMarkets.length,
      marketsSelected: Math.min(validMarkets.length, 10),
    },
  };
}
