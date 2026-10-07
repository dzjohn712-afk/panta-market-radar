# Panta Market Radar

Panta Market Radar is a standalone, read-only prediction-market intelligence project built with Next.js and TypeScript.

Task 1 provides the API foundation: it loads active primary and secondary catalog markets, validates and filters them, and exposes at most 20 preselected candidates through `GET /api/radar`. Current-price, trade-activity, Radar Score, and dashboard work are intentionally deferred.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Set `PANTA_API_KEY` to a Panta server API key.
3. Run `npm install` and `npm run dev`.

The API key is read only by the server-only Panta client and is never accepted from browser requests.

**Powered by Panta**
