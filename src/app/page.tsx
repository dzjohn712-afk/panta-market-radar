import { getRadarSnapshot } from "@/lib/panta/catalog.server";
import Link from "next/link";
import { formatDateTime, formatUsdc } from "@/lib/panta/format";
import { ActivityMetrics, PricePanel } from "@/components/market-display";
import ResolutionExplorer from "@/components/ResolutionExplorer";

export const dynamic = "force-dynamic";

function formatRemaining(endTime: number, generatedAt: string): string {
  const seconds = endTime - Math.floor(new Date(generatedAt).getTime() / 1_000);
  if (seconds <= 0) return "Closed";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.max(1, Math.floor((seconds % 3_600) / 60));
  return `${hours}h ${minutes}m`;
}

export default async function Home() {
  const snapshot = await getRadarSnapshot();
  return (
    <main className="shell" data-snapshot-generated-at={snapshot.generatedAt}>
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
          <span>Snapshot {formatDateTime(snapshot.generatedAt)}</span>
          <span>Observed in the current Panta API sample</span>
          <a href="https://github.com/Kaito-HQ/panta-api-pub" target="_blank" rel="noreferrer">Powered by Panta ↗</a>
        </div>
      <p className="snapshot-caption">Values reflect the Panta API response captured for this snapshot.</p>
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
                <h3><Link prefetch={false} className="market-link" href={`/markets/${market.marketId}`}>{market.title} <span aria-hidden="true">↗</span></Link></h3>
                <PricePanel prices={market} />
                <div className="market-facts">
                  <div><span>Observed volume</span><strong data-live-volume>{formatUsdc(market.volumeUsdc)}</strong></div>
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
          <ResolutionExplorer markets={snapshot.recentlyResolved} />
        )}
      </section>

      <section className="section pulse-section" aria-labelledby="pulse-heading">
        <div className="section-heading">
          <div><p className="section-index">03 / MARKET PULSE</p><h2 id="pulse-heading">Observed sample</h2></div>
          <p className="sample-label">Not global Panta totals</p>
        </div>
        <div className="pulse-grid">
          <div className="pulse-card"><span>Live markets observed</span><strong>{snapshot.pulse.activeMarketsObserved}</strong></div>
          <div className="pulse-card"><span>Recent resolutions observed</span><strong>{snapshot.pulse.recentResolvedObserved}</strong></div>
          <div className="pulse-card"><span>Active observed volume</span><strong data-active-volume>{formatUsdc(snapshot.pulse.activeVolumeObserved)}</strong></div>
          <div className="pulse-card"><span>Resolved observed volume</span><strong>{formatUsdc(snapshot.pulse.resolvedVolumeObserved)}</strong></div>
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
