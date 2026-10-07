import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPulse,
  inferResolvedOutcome,
  summarizeActivity,
  unavailableActivity,
} from "../src/lib/panta/insights.ts";
import {
  normalizeResolvedMarkets,
  selectRecentlyResolved,
} from "../src/lib/panta/normalize.ts";
import type {
  LiveMarketItem,
  PantaMarket,
  ResolvedMarketItem,
} from "../src/lib/panta/types.ts";

const NOW = 1_800_000_000;

function resolvedMarket(index: number, resolutionTime: number | null): PantaMarket {
  return {
    marketId: String(index).repeat(32),
    category: index % 2 ? "sports" : "crypto",
    title: `Resolved ${index}`,
    phase: "resolved",
    status: "resolved",
    resolved: true,
    resolutionTime,
    volumeUsdc: String(index * 10),
  };
}

test("aggregates recent activity using only valid block times", () => {
  const summary = summarizeActivity(
    [
      { blockTime: NOW - 100 },
      { blockTime: NOW - 7_200 },
      { blockTime: NOW - 90_000 },
      { blockTime: null },
    ],
    NOW,
  );

  assert.deepEqual(summary, {
    activityUnavailable: false,
    trades1h: 1,
    trades24h: 2,
    latestTradeTime: NOW - 100,
    observedTradeCount: 4,
    timestampedTradeCount: 3,
    unclassifiedTradeCount: 1,
    mayBeTruncated: false,
  });
});

test("distinguishes a failed activity request from a successful empty tape", () => {
  const empty = summarizeActivity([], NOW);
  const failed = unavailableActivity();

  assert.equal(empty.activityUnavailable, false);
  assert.equal(empty.trades1h, 0);
  assert.equal(empty.trades24h, 0);
  assert.equal(failed.activityUnavailable, true);
  assert.equal(failed.trades1h, null);
  assert.equal(failed.trades24h, null);
});

test("marks a full 200-row trade response as potentially truncated", () => {
  const trades = Array.from({ length: 200 }, () => ({ blockTime: NOW - 60 }));
  assert.equal(summarizeActivity(trades, NOW).mayBeTruncated, true);
});

test("orders recently resolved markets newest first and limits them", () => {
  const normalized = normalizeResolvedMarkets([
    resolvedMarket(1, NOW - 300),
    resolvedMarket(2, NOW - 100),
    resolvedMarket(3, null),
  ]);
  const selected = selectRecentlyResolved(normalized, 2);

  assert.deepEqual(
    selected.map((market) => market.title),
    ["Resolved 2", "Resolved 1"],
  );
});

test("infers resolved outcomes only for unambiguous terminal prices", () => {
  assert.equal(
    inferResolvedOutcome({
      yesProbability: 0.99,
      noProbability: 0.01,
      priceUnavailable: false,
    }),
    "yes",
  );
  assert.equal(
    inferResolvedOutcome({
      yesProbability: 0.01,
      noProbability: 0.99,
      priceUnavailable: false,
    }),
    "no",
  );
  assert.equal(
    inferResolvedOutcome({
      yesProbability: 0.52,
      noProbability: 0.48,
      priceUnavailable: false,
    }),
    "unknown",
  );
});

test("calculates pulse metrics only from loaded market items", () => {
  const live = [
    {
      market: {
        marketId: "1".repeat(32),
        category: "sports",
        title: "Live",
        description: null,
        phase: "secondary",
        marketType: null,
        startTime: null,
        endTime: NOW + 1_000,
        resolutionTime: null,
        region: null,
        volumeUsdc: 11,
        yesProbability: 0.5,
        noProbability: 0.5,
        priceUnavailable: false,
      },
      activity: summarizeActivity([], NOW),
    },
  ] satisfies LiveMarketItem[];
  const resolved = [
    {
      market: {
        marketId: "2".repeat(32),
        category: "crypto",
        title: "Resolved",
        description: null,
        phase: "resolved",
        marketType: null,
        endTime: NOW - 1_000,
        resolutionTime: NOW - 500,
        region: null,
        volumeUsdc: 25,
        yesProbability: 1,
        noProbability: 0,
        priceUnavailable: false,
      },
      outcome: "yes",
    },
  ] satisfies ResolvedMarketItem[];

  assert.deepEqual(buildPulse(live, resolved), {
    activeMarketsObserved: 1,
    recentResolvedObserved: 1,
    categoriesObserved: ["crypto", "sports"],
    activeVolumeObserved: 11,
    resolvedVolumeObserved: 25,
  });
});
