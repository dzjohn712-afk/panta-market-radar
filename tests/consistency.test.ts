import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { formatProbability, formatUsdc } from "../src/lib/panta/format.ts";
import { pricesFromDetail, activeWithPrices, buildPulse } from "../src/lib/panta/insights.ts";
import { discoverResolvedCatalog } from "../src/lib/panta/resolved-discovery.ts";
import type { PantaMarket } from "../src/lib/panta/types.ts";

function row(index: number, overrides: Partial<PantaMarket> = {}): PantaMarket {
  return { marketId: `${"1".repeat(30)}${"123456789ABCDEFGH"[index]}1`, title: `Market ${index}`,
    category: "sports", phase: "resolved", resolved: true,
    resolutionTime: 1_700_000_000 + index, volumeUsdc: "11.00", ...overrides };
}

test("formats probabilities and volumes without converting missing values into zero", () => {
  assert.equal(formatProbability(0.518009008), "52%");
  assert.equal(formatProbability(0.481990992), "48%");
  assert.equal(formatUsdc(11), "$11.00");
  for (const missing of [null, undefined, "", NaN, Infinity, -1]) {
    assert.equal(formatProbability(missing), "—");
    assert.equal(formatUsdc(missing), "—");
  }
  assert.equal(formatProbability(0), "0%");
  assert.equal(formatUsdc(0), "$0.00");
});

test("null detail prices are unavailable and do not hide valid phase-specific prices", () => {
  const absent = pricesFromDetail(row(1, { yesPrice: null, noPrice: null }), "secondary");
  assert.equal(absent.priceUnavailable, true);
  assert.equal(absent.yesProbability, null);
  const valid = pricesFromDetail(row(1, {
    yesPrice: null, noPrice: null, secondaryYesPrice: "0.518009008", secondaryNoPrice: "0.481990992",
  }), "secondary");
  assert.equal(formatProbability(valid.yesProbability), "52%");
  assert.equal(formatProbability(valid.noProbability), "48%");
});

test("resolved fallback is bounded, locally filtered, deduplicated, ordered and capped", async () => {
  const calls: Array<{ status?: string; cursor?: string }> = [];
  const result = await discoverResolvedCatalog(async (options) => {
    calls.push(options);
    if (options.status) return { items: [], nextCursor: "ignored-filtered-cursor" };
    if (!options.cursor) return { items: [row(1), row(2, { resolved: false, phase: "secondary" }),
      row(3, { title: " " }), row(4, { resolutionTime: -1 })], nextCursor: "page-2" };
    return { items: [row(1), ...Array.from({length: 12}, (_, index) => row(index + 2))], nextCursor: "page-3" };
  });
  assert.equal(calls.length, 3);
  assert.equal(calls[1]?.status, undefined);
  assert.equal(calls[2]?.cursor, "page-2");
  assert.equal(result.coverage.fallbackPagesFetched, 2);
  assert.equal(result.selected.length, 10);
  assert.equal(result.selected[0]?.title, "Market 13");
  assert.equal(new Set(result.selected.map((market) => market.marketId)).size, 10);
});

test("fallback still rejects active and malformed rows", async () => {
  const result = await discoverResolvedCatalog(async ({status}) => ({ items: status ? [] : [
    row(1), row(2, {resolved:false, phase:"secondary"}), row(3, {marketId:"bad"}),
    row(4, {resolutionTime: -1}), row(5, {title:""}),
  ] }));
  assert.equal(result.selected.length, 1);
  assert.equal(result.coverage.fallbackPagesFetched, 1);
});

test("valid filtered resolved rows skip fallback", async () => {
  let calls = 0;
  const result = await discoverResolvedCatalog(async () => { calls += 1; return {items:[row(1)]}; });
  assert.equal(calls, 1);
  assert.equal(result.coverage.fallbackPagesFetched, 0);
});

test("page and API call the same loader backed by Next Data Cache with 150-second revalidation", async () => {
  const page = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../src/app/api/radar/route.ts", import.meta.url), "utf8");
  for (const entry of [page, route]) {
    assert.match(entry, /getRadarSnapshot.*|@\/lib\/panta\/catalog\.server/);
    assert.match(entry, /await getRadarSnapshot\(\)/);
  }
  const loader = await readFile(new URL("../src/lib/panta/catalog.server.ts", import.meta.url), "utf8");
  assert.match(loader, /export const getRadarSnapshot = unstable_cache\(/);
  assert.match(loader, /buildRadarSnapshot\.bind\(null\)/);
  // Simulate distinct compiled local names. Next includes callback source
  // text in the cache key, so both bundles must supply the same function text.
  const pageBuilder = async () => ({generation:"page"});
  const apiBuilder = async () => ({generation:"api"});
  assert.equal(pageBuilder.bind(null).toString(), apiBuilder.bind(null).toString());
  assert.match(loader, /SNAPSHOT_TTL_MS = 150_000/);
  assert.match(loader, /revalidate: SNAPSHOT_TTL_MS \/ 1_000/);
});

test("detail volume cannot overwrite catalog volume and missing pulse volumes remain unavailable", () => {
  const market = {marketId: row(1).marketId, category:"sports", title:"Live", description:null,
    phase:"secondary" as const, marketType:null, startTime:null, endTime:2_000_000_000,
    resolutionTime:null, region:null, volumeUsdc:11};
  assert.equal(activeWithPrices(market, row(1, {volumeUsdc:0})).volumeUsdc, 11);
  const pulse = buildPulse([{market:{...activeWithPrices(market,null), volumeUsdc:null}, activity:{
    activityUnavailable:true, trades1h:null, trades24h:null, latestTradeTime:null,
    observedTradeCount:null, mayBeTruncated:false,
  }}], []);
  assert.equal(pulse.activeVolumeObserved, null);
  assert.equal(pulse.resolvedVolumeObserved, 0);
});
