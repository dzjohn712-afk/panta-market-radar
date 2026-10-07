import assert from "node:assert/strict";
import test from "node:test";
import { singleFlight, mapConcurrent } from "../src/lib/panta/coordination.ts";
import { upstreamNamespace } from "../src/lib/panta/cache-namespace.ts";
import { enrichLiveCandidate, loadRadarSnapshot, type RadarClient } from "../src/lib/panta/radar-loader.ts";
import { summarizeActivity, unavailableActivity } from "../src/lib/panta/insights.ts";
import { normalizeCatalogMarket } from "../src/lib/panta/normalize.ts";
import type { PantaMarket } from "../src/lib/panta/types.ts";

const NOW = Math.floor(Date.now() / 1000);
const raw: PantaMarket = {marketId:"1".repeat(32),title:"Live",category:"sports",phase:"secondary",
  status:"secondary",resolved:false,endTime:NOW+86400,volumeUsdc:"11.00",yesPrice:"0.52",noPrice:"0.48"};
function client(overrides: Partial<RadarClient> = {}): RadarClient {
  return {listMarkets:async ({status})=>({items:status === "primary" ? [raw] : []}),
    getMarket:async ()=>raw, getMarketTrades:async ()=>({marketId:raw.marketId,items:[]}), ...overrides};
}

test("null and invalid timestamps are unclassified, never definite zero activity", () => {
  const result = summarizeActivity([{blockTime:null},{blockTime:NaN},{blockTime:-1}],NOW);
  assert.equal(result.observedTradeCount,3);
  assert.equal(result.timestampedTradeCount,0);
  assert.equal(result.unclassifiedTradeCount,3);
  assert.equal(result.trades24h,0);
  assert.equal(result.latestTradeTime,null);
});
test("recent windows include both boundaries and exclude future timestamps", () => {
  const result = summarizeActivity([{blockTime:NOW},{blockTime:NOW-3600},{blockTime:NOW-86400},
    {blockTime:null},{blockTime:NOW+1}],NOW);
  assert.equal(result.trades1h,2);
  assert.equal(result.trades24h,3);
  assert.equal(result.timestampedTradeCount,3);
  assert.equal(result.unclassifiedTradeCount,2);
  assert.equal(result.latestTradeTime,NOW);
});
test("empty and failed trade responses retain distinct count semantics", () => {
  const empty = summarizeActivity([],NOW);
  assert.equal(empty.unclassifiedTradeCount,0);
  assert.equal(empty.observedTradeCount,0);
  assert.equal(empty.timestampedTradeCount,0);
  const failed = unavailableActivity();
  assert.equal(failed.activityUnavailable,true);
  assert.equal(failed.timestampedTradeCount,null);
});
test("two concurrent cold radar builds share one promise and one loader invocation", async () => {
  const flights = new Map<string,Promise<unknown>>();
  let builds = 0;
  const build = async () => { builds += 1; return loadRadarSnapshot(client(),false,()=>NOW*1000); };
  const first = singleFlight(flights,"production/live",build);
  const second = singleFlight(flights,"production/live",build);
  assert.strictEqual(first,second);
  const [a,b] = await Promise.all([first,second]);
  assert.strictEqual(a,b);
  assert.equal(builds,1);
  assert.equal(flights.size,0);
});
test("failed in-flight builds clear and can retry; namespaces stay separate", async () => {
  const flights = new Map<string,Promise<unknown>>();
  await assert.rejects(singleFlight(flights,"prod",async ()=>{throw Error("failed");}));
  assert.equal(flights.size,0);
  assert.equal(await singleFlight(flights,"prod",async ()=>"retry"),"retry");
  const [prod,dev] = await Promise.all([singleFlight(flights,"prod",async ()=>"prod"),singleFlight(flights,"dev",async ()=>"dev")]);
  assert.deepEqual([prod,dev],["prod","dev"]);
});
test("concurrency helper limits work to five and preserves output order", async () => {
  let active = 0, peak = 0;
  const result = await mapConcurrent(Array.from({length:20},(_,i)=>i),5,async (i)=>{
    active++; peak=Math.max(peak,active);
    await new Promise(resolve=>setTimeout(resolve,5)); active--; return i;
  });
  assert.equal(peak,5);
  assert.deepEqual(result,Array.from({length:20},(_,i)=>i));
});
test("one enrichment pool bounds active and resolved HTTP concurrency together", async () => {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const activeRows = Array.from({length:20},(_,i)=>({...raw,marketId:alphabet[i]!.repeat(32)}));
  const resolvedRows = Array.from({length:10},(_,i)=>({...raw,marketId:alphabet[i+20]!.repeat(32),
    resolved:true,phase:"resolved",resolutionTime:NOW-10}));
  let inFlight=0, peak=0, requests=0;
  async function request<T>(value:T) {
    inFlight++; requests++; peak=Math.max(peak,inFlight);
    await new Promise(resolve=>setTimeout(resolve,3)); inFlight--; return value;
  }
  const snapshot = await loadRadarSnapshot(client({
    listMarkets:async ({status})=>({items:status === "primary" ? activeRows : status === "resolved" ? resolvedRows : []}),
    getMarket:async (id)=>request([...activeRows,...resolvedRows].find(row=>row.marketId===id)!),
    getMarketTrades:async (id)=>request({marketId:id,items:[]}),
  }));
  assert.equal(snapshot.live.length,20);
  assert.equal(snapshot.recentlyResolved.length,10);
  assert.equal(requests,50);
  assert.ok(peak<=10, `Peak upstream requests: ${peak}`);
});
test("active candidates with resolved or cancelled detail are excluded", async () => {
  const market = normalizeCatalogMarket(raw,NOW)!;
  for (const detail of [{...raw,resolved:true},{...raw,phase:"resolved"},{...raw,status:"cancelled"},{...raw,status:"canceled"}]) {
    assert.equal(await enrichLiveCandidate(market,client({getMarket:async()=>detail}),NOW),null);
  }
  const consistent = await enrichLiveCandidate(market,client({getMarket:async()=>({...raw,volumeUsdc:0})}),NOW);
  assert.equal(consistent?.market.phase,"secondary");
  assert.equal(consistent?.market.volumeUsdc,11);
});
test("resolved discovery failure preserves active data and unavailable pulse values", async () => {
  const snapshot = await loadRadarSnapshot(client({listMarkets:async ({status})=>{
    if (status === "resolved") throw Error("resolved offline");
    return {items:status === "primary" ? [raw] : []};
  }}),true,()=>NOW*1000);
  assert.equal(snapshot.live.length,1);
  assert.equal(snapshot.coverage.resolved.available,false);
  assert.equal(snapshot.coverage.resolved.rowsFetched,null);
  assert.equal(snapshot.pulse.recentResolvedObserved,null);
  assert.equal(snapshot.pulse.resolvedVolumeObserved,null);
});
test("lifecycle conflicts are counted only in development diagnostics", async () => {
  const snapshot = await loadRadarSnapshot(client({getMarket:async()=>({...raw,resolved:true})}),true);
  assert.equal(snapshot.live.length,0);
  assert.equal(snapshot.diagnostics?.lifecycleConflicts,1);
  assert.equal((await loadRadarSnapshot(client(),false)).diagnostics,undefined);
});
test("upstream namespace is normalized and strips all URL secrets", () => {
  assert.equal(upstreamNamespace(" https://EXAMPLE.com/api/v1/ "),"https://example.com/api/v1");
  assert.equal(upstreamNamespace("https://user:password@example.com/api/v1?token=secret#secret"),"https://example.com/api/v1");
  assert.notEqual(upstreamNamespace("https://live.example/api"),upstreamNamespace("https://staging.example/api"));
});
