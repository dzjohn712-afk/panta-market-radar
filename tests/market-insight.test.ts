import assert from "node:assert/strict";
import test from "node:test";
import { buildMarketInsight, filterResolvedMarkets } from "../src/lib/panta/market-insight.ts";
import { formatProbability, formatUsdc } from "../src/lib/panta/format.ts";
import type { PantaMarket, ResolvedMarketItem } from "../src/lib/panta/types.ts";

const NOW = 1_800_000_000;
const active: PantaMarket = {
  marketId:"1".repeat(32),title:"A live market",category:"sports",phase:"secondary",
  resolved:false,endTime:NOW+86_400,startTime:NOW-86_400,region:"Global",
  volumeUsdc:"11.00",yesPrice:"0.518009008",noPrice:"0.481990992",
};

test("active detail model retains metadata and observed activity", () => {
  const insight = buildMarketInsight(active,[{blockTime:NOW-60},{blockTime:NOW-7_200}],NOW)!;
  assert.equal(insight.state,"live");
  assert.equal(insight.market.region,"Global");
  assert.equal(formatProbability(insight.market.yesProbability),"52%");
  assert.equal(formatProbability(insight.market.noProbability),"48%");
  assert.equal(insight.activity?.trades1h,1);
  assert.equal(insight.activity?.trades24h,2);
  assert.equal(insight.activity?.observedTradeCount,2);
});

test("resolved detail models infer YES and NO and omit trade activity", () => {
  for (const [yes,no,state] of [[1,0,"resolved-yes"],[0,1,"resolved-no"]] as const) {
    const insight = buildMarketInsight({...active,phase:"resolved",resolved:true,yesPrice:yes,noPrice:no},[],NOW)!;
    assert.equal(insight.state,state);
    assert.equal(insight.activity,null);
  }
});

test("unavailable resolved prices remain unknown rather than zero", () => {
  const insight = buildMarketInsight({...active,phase:"resolved",resolved:true,yesPrice:null,noPrice:null},null,NOW)!;
  assert.equal(insight.state,"resolution-unknown");
  assert.equal(insight.market.priceUnavailable,true);
  assert.equal(formatProbability(insight.market.yesProbability),"—");
});

test("detail zero volume is preserved while unavailable volume stays nullable", () => {
  assert.equal(formatUsdc(buildMarketInsight({...active,volumeUsdc:0},[],NOW)!.market.volumeUsdc),"$0.00");
  for (const volume of [undefined,null,"invalid"]) {
    const insight = buildMarketInsight({...active,volumeUsdc:volume},[],NOW)!;
    assert.equal(insight.market.volumeUsdc,null);
    assert.equal(formatUsdc(insight.market.volumeUsdc),"—");
  }
});

test("active activity failure and an empty trade response remain distinct", () => {
  const failed = buildMarketInsight(active,null,NOW)!;
  const empty = buildMarketInsight(active,[],NOW)!;
  assert.equal(failed.activity?.activityUnavailable,true);
  assert.equal(failed.activity?.trades1h,null);
  assert.equal(empty.activity?.activityUnavailable,false);
  assert.equal(empty.activity?.trades1h,0);
});

test("expired or cancelled detail is never labeled LIVE", () => {
  assert.equal(buildMarketInsight({...active,endTime:NOW-1},null,NOW)?.state,"inactive");
  assert.equal(buildMarketInsight({...active,status:"cancelled"},null,NOW)?.state,"inactive");
});

test("Resolution Explorer combines category and outcome filters over the supplied sample", () => {
  const items: ResolvedMarketItem[] = [
    {market:{marketId:"1".repeat(32),title:"Sports YES",description:null,category:"sports",phase:"resolved",marketType:null,endTime:null,resolutionTime:null,region:null,volumeUsdc:0,yesProbability:1,noProbability:0,priceUnavailable:false},outcome:"yes"},
    {market:{marketId:"2".repeat(32),title:"Crypto NO",description:null,category:"crypto",phase:"resolved",marketType:null,endTime:null,resolutionTime:null,region:null,volumeUsdc:null,yesProbability:0,noProbability:1,priceUnavailable:false},outcome:"no"},
    {market:{marketId:"3".repeat(32),title:"Crypto unknown",description:null,category:"crypto",phase:"resolved",marketType:null,endTime:null,resolutionTime:null,region:null,volumeUsdc:11,yesProbability:null,noProbability:null,priceUnavailable:true},outcome:"unknown"},
  ];
  assert.equal(filterResolvedMarkets(items).length,3);
  assert.equal(filterResolvedMarkets(items,"crypto").length,2);
  assert.deepEqual(filterResolvedMarkets(items,"all","yes").map(item=>item.market.title),["Sports YES"]);
  assert.deepEqual(filterResolvedMarkets(items,"crypto","unknown").map(item=>item.market.title),["Crypto unknown"]);
  assert.equal(filterResolvedMarkets(items,"sports","no").length,0);
  assert.equal(items.length,3);
});
