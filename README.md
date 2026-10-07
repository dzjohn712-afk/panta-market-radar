# Panta Market Radar

Panta Market Radar is a standalone, read-only **Live Market & Resolution Intelligence** product built with Next.js and TypeScript.

Task 1 provides the API foundation: it loads up to three 50-row pages for each active lifecycle, validates and filters them, and exposes at most 20 preselected candidates through `GET /api/radar`. Discovery stops early when cursors end or 20 valid unique markets are available, and can never exceed six list requests per snapshot. Current-price, trade-activity, Radar Score, and dashboard work are intentionally deferred.

The live snapshot enriches active candidates with detail prices and recent trade activity. Resolved discovery first validates one filtered page; if none are valid, it samples at most two unfiltered pages, sorts and selects at most ten resolved markets. It calculates Market Pulse only from selected markets.

The homepage and `/api/radar` call the same loader backed by Next.js Data Cache with 150-second revalidation. The API has no additional browser/CDN response cache. Compare the API's `generatedAt` with the homepage's `data-snapshot-generated-at` to verify the generation. Missing or invalid prices/volumes remain `null` and render as unavailable; numeric zero remains zero. If any selected market volume is unavailable, its pulse volume total is also unavailable rather than an incomplete sum.

In development, `/api/radar` also returns aggregate catalog rejection diagnostics. Rejection counters are not mutually exclusive, and diagnostics are omitted from production responses.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Set `PANTA_API_KEY` to a Panta server API key.
3. Run `npm install` and `npm run dev`.

The API key is read only by the server-only Panta client and is never accepted from browser requests.

**Powered by Panta**

## Market Intelligence Detail & Resolution Explorer

Live cards and resolution rows open `/markets/[marketId]`. A focused server-only loader captures a detail response and, for valid active markets, at most 200 trade rows. Resolved or inactive markets skip trade fetching. Detail snapshots have their own timestamp and a 150-second cache; they may differ from the homepage sample captured earlier.

The Resolution Explorer filters the already loaded sample by category and YES / NO / Unknown outcome. Changing filters does not fetch upstream data. Market links disable automatic prefetching to keep API usage tied to navigation.

Unavailable prices and volumes remain unavailable, and resolved outcomes are inferred only from unambiguous detail price pairs. The interface supports keyboard links, visible focus, and narrow-screen layouts. No remote images are required.
