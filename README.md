# Panta Market Radar

**Live Market & Resolution Intelligence** — a standalone, read-only Next.js + TypeScript application. Powered by Panta.

## Implemented

- Live market probabilities from detail responses and recent timestamped trade activity.
- A sampled Resolution Explorer with category/outcome filters and market detail pages.
- Market Pulse metrics derived only from the loaded sample.
- Explicit unavailable states for missing prices, volume, activity, or resolved discovery.

No wallets, transactions, authentication, AI, database, or persistent market history.

## Run locally

Requires Node.js **22.18.0 or newer**.

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and configure:
   - `PANTA_API_BASE_URL`: fixed upstream URL, normally `https://live-api.panta.market/api/v1`.
   - `PANTA_API_KEY`: your server-side Panta API key.
3. Run `npm run dev` and open `http://localhost:3000`.

For a production build, run `npm run build`, then `npm start`.

Validation: `npm run lint`, `npm run typecheck`, and `npm test`.

## Data and cache semantics

The homepage and `/api/radar` share a Next.js cache with 150-second revalidation. Detail pages capture separate snapshots. Cache identities include environment and normalized upstream URL, never credentials.

Discovery scans at most three 50-row pages per active phase and selects at most 20 candidates. Resolved discovery tries one filtered page and, when necessary, up to two unfiltered pages, selecting at most ten markets. These are observed samples, not global Panta totals or a complete archive.

Detail/trade enrichment uses one pool of five markets (at most ten upstream HTTP requests during enrichment). Conflicting resolved/cancelled detail evidence excludes a candidate from Live Now. A resolved-discovery failure preserves active data and marks the resolved section unavailable.

Unknown, invalid, and future trade timestamps remain unclassified; window counts cover only valid timestamps. A full 200-row trade tape may be truncated. Missing data is never substituted with numeric zero.

## Demo topology and security

The in-flight promise guard prevents duplicate cold radar builds **within one Node process** and clears after success or failure. It does not coordinate multiple instances. Use a single-instance demo or an explicitly understood shared-cache topology; development and production namespaces are separate. Next.js may serve the prior snapshot while revalidating.

`.env.local` is ignored. Never commit secrets. API credentials stay server-only, upstream access is GET-only, and there is no generic proxy or trading functionality. Products display **Powered by Panta**.
