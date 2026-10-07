"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDateTime, formatUsdc } from "@/lib/panta/format";
import { filterResolvedMarkets } from "@/lib/panta/market-insight";
import type { ResolvedMarketItem, ResolvedOutcome } from "@/lib/panta/types";
import { OutcomeBadge } from "./market-display";

export default function ResolutionExplorer({markets}: {markets: ResolvedMarketItem[]}) {
  const [category, setCategory] = useState("all");
  const [outcome, setOutcome] = useState<ResolvedOutcome | "all">("all");
  const categories = [...new Set(markets.map((item) => item.market.category))].sort();
  const visible = filterResolvedMarkets(markets, category, outcome);
  return <>
    <p className="sample-note">Recent resolutions observed in this API sample. This view is not the complete Panta history.</p>
    <div className="explorer-controls">
      <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="all">All categories</option>
        {categories.map((value) => <option key={value} value={value}>{value}</option>)}
      </select></label>
      <label>Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value as ResolvedOutcome | "all")}>
        <option value="all">All outcomes</option><option value="yes">YES</option><option value="no">NO</option><option value="unknown">Unknown</option>
      </select></label>
      <span role="status" aria-live="polite">{visible.length} of {markets.length} observed markets</span>
    </div>
    {visible.length ? <div className="resolved-list">
      <div className="resolved-header" aria-hidden="true"><span>Market</span><span>Outcome</span><span>Observed volume</span><span>Resolved</span></div>
      {visible.map(({market,outcome}) => <Link prefetch={false} className="resolved-row" key={market.marketId} href={`/markets/${market.marketId}`}>
        <div className="resolved-title"><span className="row-label">Category </span><span className="category">{market.category}</span><strong>{market.title} <span aria-hidden="true">↗</span></strong><small>{market.marketType ?? "Type unavailable"}</small></div>
        <div><span className="row-label">Outcome </span><OutcomeBadge outcome={outcome} /></div>
        <div><span className="row-label">Observed volume </span><strong>{formatUsdc(market.volumeUsdc)}</strong></div>
        <div><span className="row-label">Resolution time </span><span>{formatDateTime(market.resolutionTime)}</span></div>
      </Link>)}
    </div> : <div className="empty-state compact"><span>NO MATCHING RECORDS</span><h3>No resolutions match these filters</h3><button onClick={() => {setCategory("all");setOutcome("all");}}>Clear filters</button></div>}
  </>;
}
