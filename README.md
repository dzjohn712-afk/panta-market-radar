# Panta Market Radar

**Live Market & Resolution Intelligence** — a read-only view of the current Panta API sample, with live probabilities, trade activity, and recent resolutions.

## Why it exists

Prediction-market APIs can expose sparse, inconsistent, and fast-changing state. Panta Market Radar turns the current sample into a clear intelligence view while preserving uncertainty instead of inventing missing data.

## What it does

- **Live Now:** current YES/NO probabilities from market detail, observed volume, closing time, and timestamped trade activity.
- **Recently Resolved:** a sampled resolution explorer with category and YES/NO/Unknown filters.
- **Market Pulse:** counts, categories, and volume derived only from loaded markets.
- **Market detail:** metadata, probabilities, lifecycle, outcome, and active-market activity.
- **Snapshot semantics:** capture timestamps and honest unavailable states. Unknown/future trade timestamps remain unclassified; missing prices and volume never become zero.

## Panta API integration

| Endpoint | Use |
|---|---|
| `GET /markets/` | Bounded catalog discovery and local lifecycle validation |
| `GET /markets/{marketId}/` | Current prices, detail metadata, and lifecycle evidence |
| `GET /markets/{marketId}/trades/?limit=200` | Active-market activity; nullable timestamps are handled explicitly |

Active discovery scans at most three 50-row pages per phase and selects at most 20 candidates. Resolved discovery tries one filtered page, falling back to at most two unfiltered pages when no valid resolved markets are found, then selects at most ten. Detail evidence indicating resolution/cancellation excludes conflicting live candidates.

The API key is injected server-side through `X-Api-Key`. Catalog prices are not treated as current prices. No undocumented volume fields are used.

## Architecture

```text
Browser → Next.js App Router → server-only Panta client → Panta API
```

The homepage and `/api/radar` share a 150-second Next.js cache. Detail pages have separate timestamped captures. One enrichment pool processes five markets at a time, with at most ten upstream HTTP requests during snapshot enrichment. A process-local promise guard prevents concurrent cold radar builds within one Node process.

Resolved-discovery failure preserves active data and marks resolved data unavailable. Development diagnostics are omitted from production.

## Running locally

Requires **Node.js 22.18.0 or newer**.

```sh
npm install
```

Copy `.env.example` to `.env.local`, set your server-side API key, then run:

```sh
npm run dev
```

Open `http://localhost:3000`.

Production:

```sh
npm run build
npm start
```

The host supplies environment variables and may set `PORT`. Use **one application replica** with a persistent Node process for the demo. No Docker or additional services are required.

`GET /api/health` returns application liveness only. It does not query Panta, verify API credentials, or expose configuration.

## Environment variables

| Variable | Example / placeholder |
|---|---|
| `PANTA_API_BASE_URL` | `https://live-api.panta.market/api/v1` |
| `PANTA_API_KEY` | `replace_with_your_server_side_api_key` |

Environment files are ignored except `.env.example`. Never commit keys, JWTs, or other secrets; use the host's secret configuration for deployment. Cache identities include the normalized upstream URL, never credentials.

## Tests

The current suite covers discovery bounds, normalization, unavailable values, timestamp classification, lifecycle conflicts, resolved failure isolation, filtering, outcomes, and concurrency coordination.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run check:secrets
```

The lightweight secret check scans repository files and, after building, browser assets for key/JWT/private-key patterns and the configured API key. It is a useful check, not a guarantee against every possible secret format.

See [production smoke checklist](submission/smoke-test-checklist.md) and the text drafts in [submission/](submission/).

## Known limitations

- Bounded sampling is not global market coverage or a complete resolution archive.
- Panta responses may differ between snapshots, including missing prices or volume.
- Trade `blockTime` may be unavailable; a 200-row response may be truncated.
- No historical database, accounts, alerts, AI, or trading functionality.
- Coordination is process-local. The Next.js cache is **not a global distributed rate limiter**; multi-instance deployments need an explicitly understood cache topology.
- Next.js may serve the prior snapshot during revalidation. Separate detail captures can differ from the homepage sample.

## Powered by Panta

**Powered by Panta** is visible throughout the product. API references: [official Panta documentation](https://github.com/Kaito-HQ/panta-api-pub).
