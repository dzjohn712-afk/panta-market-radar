import Link from "next/link";

export default function MarketNotFound() {
  return <main className="shell error-shell"><p className="section-index">MARKET UNAVAILABLE</p><h1>This market could not be found</h1><p>The market ID or its metadata is unavailable in the current Panta response.</p><Link href="/">← Back to Panta Market Radar</Link></main>;
}
