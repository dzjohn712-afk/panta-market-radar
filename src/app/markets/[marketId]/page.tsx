import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarketInsight } from "@/lib/panta/market-insight.server";
import { PantaApiError } from "@/lib/panta/client.server";
import { formatDateTime, formatUsdc } from "@/lib/panta/format";
import { ActivityMetrics, PricePanel } from "@/components/market-display";

export const dynamic = "force-dynamic";

const stateLabels = {
  live: "LIVE", "resolved-yes": "RESOLVED YES", "resolved-no": "RESOLVED NO",
  "resolution-unknown": "RESOLUTION UNKNOWN", inactive: "INACTIVE",
};

export default async function MarketDetail({params}: {params: Promise<{marketId: string}>}) {
  const {marketId} = await params;
  const insight = await getMarketInsight(marketId).catch((error: unknown) => {
    if (error instanceof TypeError || (error instanceof PantaApiError && error.status === 404)) notFound();
    throw error;
  });
  const {market, state, activity} = insight;
  return <main className="shell detail-shell" data-detail-generated-at={insight.generatedAt}>
    <nav className="detail-nav" aria-label="Market navigation"><Link href="/" prefetch={false}>← Panta Market Radar</Link><a href="https://github.com/Kaito-HQ/panta-api-pub">Powered by Panta ↗</a></nav>
    <header className="detail-heading">
      <p className="section-index">MARKET INTELLIGENCE</p>
      <div className="card-topline"><span className="category">{market.category}</span><span className={`market-state state-${state}`}>{stateLabels[state]}</span></div>
      <h1>{market.title}</h1>
      {market.description && <p className="detail-description">{market.description}</p>}
      <p className="sample-note">Detail snapshot {formatDateTime(insight.generatedAt)}. Values reflect the Panta API response captured for this detail snapshot.</p>
    </header>
    <section className="detail-panel" aria-labelledby="prices-heading">
      <h2 id="prices-heading">{market.isResolved ? "Resolution prices" : "Current probabilities"}</h2>
      <PricePanel prices={market} />
      {state === "resolution-unknown" && <p className="sample-note">This market is resolved, but an unambiguous YES / NO outcome was not available.</p>}
    </section>
    <section className="detail-panel" aria-labelledby="context-heading">
      <h2 id="context-heading">Market context</h2>
      <dl className="detail-facts">
        <div><dt>Lifecycle / phase</dt><dd>{market.phase}</dd></div>
        <div><dt>Market type</dt><dd>{market.marketType ?? "Unavailable"}</dd></div>
        <div><dt>Region</dt><dd>{market.region ?? "Unavailable"}</dd></div>
        <div><dt>Observed volume</dt><dd data-detail-volume>{formatUsdc(market.volumeUsdc)}</dd></div>
        <div><dt>Start time</dt><dd>{formatDateTime(market.startTime)}</dd></div>
        <div><dt>End time</dt><dd>{formatDateTime(market.endTime)}</dd></div>
        <div><dt>Resolution time</dt><dd>{formatDateTime(market.resolutionTime)}</dd></div>
      </dl>
    </section>
    {activity && <section className="detail-panel" aria-labelledby="activity-heading"><h2 id="activity-heading">Recent trade activity</h2><ActivityMetrics activity={activity} showCount /></section>}
    <footer><span className="market-address">Market ID: {market.marketId}</span><span>Read-only market intelligence</span></footer>
  </main>;
}
