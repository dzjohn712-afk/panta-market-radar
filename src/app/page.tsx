import { getRadarCatalogSnapshot } from "@/lib/panta/catalog.server";
import type {
  ActivitySummary,
  MarketPrices,
  ResolvedOutcome,
} from "@/lib/panta/types";

export const dynamic = "force-dynamic";

const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDateTime(timestamp: number | string | null): string {
  if (timestamp === null) return "Not available";
  const date = typeof timestamp === "number" ? new Date(timestamp * 1_000) : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "Not available" : `${dateTimeFormatter.format(date)} UTC`;
}

function formatUsdc(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 1_000 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatProbability(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function formatRemaining(endTime: number, generatedAt: string): string {
  const seconds = endTime - Math.floor(new Date(generatedAt).getTime() / 1_000);
  if (seconds <= 0) return "Closed";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.max(1, Math.floor((seconds % 3_600) / 60));
  return `${hours}h ${minutes}m`;
}

function PricePanel({ prices }: { prices: MarketPrices }) {
  if (prices.priceUnavailable) {
    return <div className="data-unavailable">Current price unavailable</div>;
  }
  const yesWidth = `${Math.round((prices.yesProbability ?? 0) * 100)}%`;
  return (
    <div className="price-panel">
      <div className="price-values">
        <div><span>YES</span><strong className="yes-value">{formatProbability(prices.yesProbability)}</strong></div>
        <div><span>NO</span><strong className="no-value">{formatProbability(prices.noProbability)}</strong></div>
      </div>
      <div className="probability-track" aria-hidden="true"><span style={{ width: yesWidth }} /></div>
    </div>
  );
}

function ActivityMetrics({ activity }: { activity: ActivitySummary }) {
  if (activity.activityUnavailable) {
    return <div className="data-unavailable">Recent activity unavailable</div>;
  }
  return (
    <>
      <div className="metric-grid">
        <div className="metric"><span>Last hour</span><strong>{activity.trades1h}</strong><small>trades</small></div>
        <div className="metric"><span>Last 24h</span><strong>{activity.trades24h}</strong><small>trades</small></div>
        <div className="metric metric-wide"><span>Latest trade</span><strong className="metric-time">{formatDateTime(activity.latestTradeTime)}</strong></div>
      </div>
      {activity.mayBeTruncated && <p className="notice">Activity may be truncated at the 200-row API limit.</p>}
    </>
  );
}

function OutcomeBadge({ outcome }: { outcome: ResolvedOutcome }) {
  return <span className={`outcome outcome-${outcome}`}>{outcome.toUpperCase()}</span>;
}

export default async function Home() {
  const snapshot = await getRadarCatalogSnapshot();
  return (
    <main className="shell">
      <header className="hero">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">P</div>
          <div><p className="kicker">Prediction market monitor</p><h1>Panta Market Radar</h1></div>
          <span className="live-indicator"><i /> API LIVE</span>
        </div>
        <div className="hero-copy">
          <h2>Live Market &amp; Resolution Intelligence</h2>
          <p>A focused view of current markets, recent resolutions, and activity observed through the Panta API.</p>
        </div>
        <div className="snapshot-meta">
          <span>Last updated {formatDateTime(snapshot.generatedAt)}</span>
          <span>Observed in the current Panta API sample</span>
          <a href="https://github.com/Kaito-HQ/panta-api-pub" target="_blank" rel="noreferrer">Powered by Panta ↗</a>
        </div>
      </header>

      <section className="section" aria-labelledby="live-heading">
        <div className="section-heading">
          <div><p className="section-index">01 / LIVE NOW</p><h2 id="live-heading">Markets in motion</h2></div>
          <span className="count-pill">{snapshot.live.length} observed</span>
        </div>
        {snapshot.live.length === 0 ? (
          <div className="empty-state"><span>RADAR CLEAR</span><h3>No active markets in the current sample</h3><p>The radar is still tracking recent resolutions and sample-level market pulse.</p></div>
        ) : (
          <div className="live-grid">
            {snapshot.live.map(({ market, activity }) => (
              <article className="live-card" key={market.marketId}>
                <div className="card-topline"><span className="category">{market.category}</span><span className="phase"><i /> {market.phase}</span></div>
                <h3>{market.title}</h3>
                <PricePanel prices={market} />
                <div className="market-facts">
                  <div><span>Volume</span><strong>{formatUsdc(market.volumeUsdc)}</strong></div>
                  <div><span>Time remaining</span><strong>{formatRemaining(market.endTime, snapshot.generatedAt)}</strong></div>
                </div>
                <ActivityMetrics activity={activity} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="resolved-heading">
        <div className="section-heading">
          <div><p className="section-index">02 / RECENTLY RESOLVED</p><h2 id="resolved-heading">Resolution ledger</h2></div>
          <span className="count-pill">{snapshot.recentlyResolved.length} observed</span>
        </div>
        {snapshot.recentlyResolved.length === 0 ? (
          <div className="empty-state compact"><span>NO RECENT RECORDS</span><h3>No resolved markets were returned in this sample</h3></div>
        ) : (
          <div className="resolved-list">
            <div className="resolved-header" aria-hidden="true"><span>Market</span><span>Outcome</span><span>Volume</span><span>Resolved</span></div>
            {snapshot.recentlyResolved.map(({ market, outcome }) => (
              <article className="resolved-row" key={market.marketId}>
                <div className="resolved-title"><span className="category">{market.category}</span><strong>{market.title}</strong><small>{market.marketType ?? "standard"}</small></div>
                <OutcomeBadge outcome={outcome} />
                <strong>{formatUsdc(market.volumeUsdc)}</strong>
                <span>{formatDateTime(market.resolutionTime)}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section pulse-section" aria-labelledby="pulse-heading">
        <div className="section-heading">
          <div><p className="section-index">03 / MARKET PULSE</p><h2 id="pulse-heading">Observed sample</h2></div>
          <p className="sample-label">Not global Panta totals</p>
        </div>
        <div className="pulse-grid">
          <div className="pulse-card"><span>Active markets</span><strong>{snapshot.pulse.activeMarketsObserved}</strong></div>
          <div className="pulse-card"><span>Recent resolutions</span><strong>{snapshot.pulse.recentResolvedObserved}</strong></div>
          <div className="pulse-card"><span>Active volume</span><strong>{formatUsdc(snapshot.pulse.activeVolumeObserved)}</strong></div>
          <div className="pulse-card"><span>Resolved volume</span><strong>{formatUsdc(snapshot.pulse.resolvedVolumeObserved)}</strong></div>
        </div>
        <div className="categories-observed">
          <span>Categories observed</span>
          <div>{snapshot.pulse.categoriesObserved.length > 0 ? snapshot.pulse.categoriesObserved.map((category) => <b key={category}>{category}</b>) : <em>None in the current sample</em>}</div>
        </div>
      </section>

      <footer><span>Panta Market Radar</span><span>Read-only intelligence · No trading or wallet connection</span></footer>
    </main>
  );
}
