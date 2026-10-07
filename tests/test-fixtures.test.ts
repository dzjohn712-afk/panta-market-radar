import assert from "node:assert/strict";
import test from "node:test";
import { isExplicitTestFixture, normalizeResolvedMarkets } from "../src/lib/panta/normalize.ts";

const market = {
  marketId: "1".repeat(32), title: "Will BTC reach $100,000?", category: "crypto",
  phase: "resolved", resolved: true, resolutionTime: 1_800_000_000, volumeUsdc: "0.00",
};

test("explicit [TEST] title is excluded from resolved discovery", () => {
  const fixture = {...market, title: "[TEST] BTC >= 1000 USD"};
  assert.equal(isExplicitTestFixture(fixture), true);
  assert.deepEqual(normalizeResolvedMarkets([fixture]), []);
  assert.equal(isExplicitTestFixture({...market, title: "  [test] BTC >= 1000 USD  "}), true);
});

test("explicit Panta playground test description is excluded", () => {
  const fixture = {...market, description: "Panta API playground test market — please ignore."};
  assert.equal(isExplicitTestFixture(fixture), true);
  assert.deepEqual(normalizeResolvedMarkets([fixture]), []);
  assert.equal(isExplicitTestFixture({...market, description: " PANTA API playground  test market "}), true);
});

test("normal markets are retained regardless of test wording or zero volume", () => {
  for (const title of [market.title, "Will the rocket test succeed?", "Will BTC pass its next resistance test?"]) {
    const normal = {...market, title};
    assert.equal(isExplicitTestFixture(normal), false);
    assert.equal(normalizeResolvedMarkets([normal]).length, 1);
  }
});

test("fixtures are excluded before deduplication and cannot displace a normal row", () => {
  const fixture = {...market, title: "[TEST] Fixture", resolutionTime: market.resolutionTime + 100};
  const result = normalizeResolvedMarkets([fixture, market]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.title, market.title);
});
