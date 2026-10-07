import { formatDateTime, formatProbability } from "@/lib/panta/format";
import type { ActivitySummary, MarketPrices, ResolvedOutcome } from "@/lib/panta/types";

export function PricePanel({ prices }: { prices: MarketPrices }) {
  if (prices.priceUnavailable || prices.yesProbability === null || prices.noProbability === null) {
    return <div className="data-unavailable"><strong>Current price unavailable</strong><p>A valid YES / NO pair was not available in this snapshot.</p></div>;
  }
  return <div className="price-panel">
    <div className="price-values">
      <div><span>YES</span><strong className="yes-value">{formatProbability(prices.yesProbability)}</strong></div>
      <div><span>NO</span><strong className="no-value">{formatProbability(prices.noProbability)}</strong></div>
    </div>
    <div className="probability-track" aria-hidden="true"><span style={{width:formatProbability(prices.yesProbability)}} /></div>
  </div>;
}

export function ActivityMetrics({activity, showCount = false}: {activity: ActivitySummary; showCount?: boolean}) {
  if (activity.activityUnavailable) return <div className="data-unavailable">Recent activity unavailable</div>;
  return <>
    <div className="metric-grid">
      <div className="metric"><span>Last hour</span><strong>{activity.trades1h}</strong><small>timestamped trades</small></div>
      <div className="metric"><span>Last 24h</span><strong>{activity.trades24h}</strong><small>timestamped trades</small></div>
      <div className="metric metric-wide"><span>Latest trade</span><strong className="metric-time">{formatDateTime(activity.latestTradeTime)}</strong></div>
    </div>
    {activity.unclassifiedTradeCount > 0 && <p className="notice">{activity.unclassifiedTradeCount} observed {activity.unclassifiedTradeCount === 1 ? "trade has" : "trades have"} unknown or anomalous timing; recent counts cover timestamped trades only.</p>}
    {showCount && <p className="sample-note">{activity.observedTradeCount} trade rows observed · {activity.timestampedTradeCount} with valid timestamps.</p>}
    {activity.mayBeTruncated && <p className="notice">Activity may be truncated at the 200-row API limit.</p>}
  </>;
}

export function OutcomeBadge({outcome}: {outcome: ResolvedOutcome}) {
  return <span className={`outcome outcome-${outcome}`}>{outcome.toUpperCase()}</span>;
}
