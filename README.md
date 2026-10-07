# Panta Market Radar

Panta Market Radar is a standalone, read-only prediction-market intelligence project built with Next.js and TypeScript.

Task 1 provides the API foundation: it loads up to three 50-row pages for each active lifecycle, validates and filters them, and exposes at most 20 preselected candidates through `GET /api/radar`. Discovery stops early when cursors end or 20 valid unique markets are available, and can never exceed six list requests per snapshot. Current-price, trade-activity, Radar Score, and dashboard work are intentionally deferred.

In development, `/api/radar` also returns aggregate catalog rejection diagnostics. Rejection counters are not mutually exclusive, and diagnostics are omitted from production responses.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Set `PANTA_API_KEY` to a Panta server API key.
3. Run `npm install` and `npm run dev`.

The API key is read only by the server-only Panta client and is never accepted from browser requests.

**Powered by Panta**
