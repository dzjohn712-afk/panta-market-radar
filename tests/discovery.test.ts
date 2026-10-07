import assert from "node:assert/strict";
import test from "node:test";
import { discoverActiveCatalog } from "../src/lib/panta/discovery.ts";
import { selectCatalogCandidates } from "../src/lib/panta/normalize.ts";
import type {
  ActiveMarketStatus,
  PantaMarket,
  PantaMarketsResponse,
} from "../src/lib/panta/types.ts";

const NOW = 1_800_000_000;
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function marketId(index: number): string {
  const first = BASE58[index % BASE58.length];
  const second = BASE58[Math.floor(index / BASE58.length) % BASE58.length];
  return `${first}${second}${first.repeat(30)}`;
}

function market(index: number, overrides: Partial<PantaMarket> = {}): PantaMarket {
  return {
    marketId: marketId(index),
    category: "sports",
    title: `Market ${index}`,
    phase: "primary",
    endTime: NOW + 86_400 + index,
    resolved: false,
    status: "primary",
    volumeUsdc: String(index),
    ...overrides,
  };
}

test("stops each phase when nextCursor disappears", async () => {
  const calls: Array<{ status: ActiveMarketStatus; cursor?: string }> = [];
  const result = await discoverActiveCatalog(
    async (status, cursor) => {
      calls.push({ status, cursor });
      return { items: [market(status === "primary" ? 1 : 2, { phase: status })] };
    },
    { nowSeconds: NOW },
  );

  assert.equal(calls.length, 2);
  assert.equal(result.primaryPagesFetched, 1);
  assert.equal(result.secondaryPagesFetched, 1);
});

test("never fetches more than three pages per phase", async () => {
  const calls: Record<ActiveMarketStatus, number> = { primary: 0, secondary: 0 };
  const result = await discoverActiveCatalog(
    async (status): Promise<PantaMarketsResponse> => {
      calls[status] += 1;
      return {
        items: [],
        nextCursor: `${status}-${calls[status]}`,
      };
    },
    { nowSeconds: NOW },
  );

  assert.deepEqual(calls, { primary: 3, secondary: 3 });
  assert.equal(result.primaryPagesFetched, 3);
  assert.equal(result.secondaryPagesFetched, 3);
});

test("deduplicates across pages and phases and records conflicting duplicates", async () => {
  const sharedId = marketId(1);
  const calls: Record<ActiveMarketStatus, number> = { primary: 0, secondary: 0 };

  const result = await discoverActiveCatalog(
    async (status): Promise<PantaMarketsResponse> => {
      calls[status] += 1;
      if (calls[status] === 1) {
        return {
          items:
            status === "primary"
              ? [market(1, { marketId: sharedId, phase: "primary", volumeUsdc: "5" })]
              : [],
          nextCursor: `${status}-page-2`,
        };
      }
      return {
        items:
          status === "secondary"
            ? [
                market(2, {
                  marketId: sharedId,
                  phase: "secondary",
                  status: "secondary",
                  volumeUsdc: "11",
                }),
                market(3, { phase: "secondary", status: "secondary" }),
              ]
            : [],
        nextCursor: null,
      };
    },
    { nowSeconds: NOW },
  );

  assert.equal(result.validMarkets.length, 2);
  assert.equal(result.validMarkets.find((item) => item.marketId === sharedId)?.phase, "secondary");
  assert.equal(result.diagnostics.duplicateRows, 1);
  assert.equal(result.diagnostics.conflictingDuplicateRows, 1);
});

test("candidate selection remains capped at 20 after paginated discovery", async () => {
  const result = await discoverActiveCatalog(
    async (status) => ({
      items: Array.from({ length: 15 }, (_, index) =>
        market(index + (status === "primary" ? 1 : 20), {
          phase: status,
          status,
        }),
      ),
      nextCursor: null,
    }),
    { nowSeconds: NOW },
  );

  assert.equal(result.validMarkets.length, 30);
  assert.equal(selectCatalogCandidates(result.validMarkets).length, 20);
});
