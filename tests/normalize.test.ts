import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeAndDeduplicateMarkets,
  normalizeCatalogMarket,
  selectCatalogCandidates,
} from "../src/lib/panta/normalize.ts";
import type { PantaMarket } from "../src/lib/panta/types.ts";

const NOW = 1_800_000_000;
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function marketId(index: number): string {
  return BASE58[index % BASE58.length].repeat(32);
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

test("normalizes a valid active catalog row without catalog prices", () => {
  const normalized = normalizeCatalogMarket(
    market(1, { title: "  Valid title  ", yesPrice: "0.9", volumeUsdc: "12.50" }),
    NOW,
  );

  assert.equal(normalized?.title, "Valid title");
  assert.equal(normalized?.volumeUsdc, 12.5);
  assert.equal("yesPrice" in (normalized ?? {}), false);
});

test("filters malformed, untitled, inactive, resolved, cancelled, and expired rows", () => {
  const rows = [
    market(1),
    market(2, { title: "   " }),
    market(3, { marketId: "not-base58" }),
    market(4, { phase: "resolved" }),
    market(5, { resolved: true }),
    market(6, { status: "cancelled" }),
    market(7, { endTime: NOW }),
    market(8, { category: "" }),
  ];

  const normalized = normalizeAndDeduplicateMarkets(rows, NOW);
  assert.deepEqual(normalized.map((item) => item.marketId), [marketId(1)]);
});

test("deduplicates by marketId and prefers the secondary lifecycle row", () => {
  const id = marketId(9);
  const normalized = normalizeAndDeduplicateMarkets(
    [
      market(9, { marketId: id, phase: "primary", volumeUsdc: "100" }),
      market(10, { marketId: id, phase: "secondary", volumeUsdc: "20" }),
    ],
    NOW,
  );

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0]?.phase, "secondary");
});

test("preselects at most 20 using volume, closing time, and crypto representation", () => {
  const rows = Array.from({ length: 30 }, (_, index) =>
    market(index + 1, {
      category: index === 29 ? "crypto" : "sports",
      volumeUsdc: String(1_000 - index),
      endTime: NOW + 100_000 + index,
    }),
  );
  rows[28] = market(29, {
    volumeUsdc: "0",
    endTime: NOW + 1,
    category: "world",
  });

  const normalized = normalizeAndDeduplicateMarkets(rows, NOW);
  const selected = selectCatalogCandidates(normalized);

  assert.equal(selected.length, 20);
  assert.ok(selected.some((item) => item.marketId === marketId(29)));
  assert.ok(selected.some((item) => item.category === "crypto"));
  assert.equal(new Set(selected.map((item) => item.marketId)).size, selected.length);
});
