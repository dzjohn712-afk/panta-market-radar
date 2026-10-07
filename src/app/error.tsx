"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="shell error-shell">
      <div className="brand-mark" aria-hidden="true">P</div>
      <p className="section-index">RADAR INTERRUPTED</p>
      <h1>Market data is temporarily unavailable</h1>
      <p>The Panta API could not be reached or returned an unexpected response.</p>
      <button type="button" onClick={reset}>Try again</button>
      <small>Powered by Panta</small>
    </main>
  );
}
