# Panta Sidetrack submission draft

Preparation draft in English. Check the current Superteam listing and required fields before submission.

## What was built

**Panta Market Radar — Live Market & Resolution Intelligence.** A read-only application with live market monitoring, a sampled recent-resolution explorer, individual detail pages, and Market Pulse summaries.

## Problem and use case

Users need to understand prediction-market state even when catalogs are sparse or responses change. The application highlights what the Panta API currently provides while explicitly distinguishing unavailable prices, volume, and activity from real zero values.

## Meaningful Panta API integration

The server loads bounded samples through `GET /markets/`, validates lifecycle locally, and uses a bounded unfiltered fallback for resolved discovery. Market detail requests provide current prices and lifecycle evidence. Active-market trade requests provide timestamped 1-hour/24-hour counts, latest trade time, and unknown-timing/truncation notices. Catalog prices are not substituted for current prices.

## Working-demo description

The locally tested demo shows Live Now, Recently Resolved with category and outcome filters, Market Pulse, and linked intelligence pages. Values reflect the captured API snapshot and may change before recording. The demo supports honest empty, partial, and unavailable states.

## Technical highlights

- Next.js App Router, TypeScript, and server-only `X-Api-Key` authentication.
- Shared 150-second radar cache with a same-process cold-build guard.
- Five-market enrichment pool and bounded catalog pagination.
- Read-only integration with no wallet, transaction signing, or database.
- Regression tests for uncertainty, lifecycle validation, filtering, and concurrency.
- Visible **Powered by Panta** attribution.

## Limitations and sample semantics

Counts and volume cover the loaded sample, not the full Panta ecosystem. Nullable or future trade timestamps remain unclassified. A full 200-row trade tape may be truncated. Detail captures can differ from homepage captures. The demo deployment should use one application replica.

## Links to complete

- Working demo: `<DEPLOYMENT_URL>`
- Colosseum project: `<COLOSSEUM_PROJECT_URL>`
- Demo video: `<DEMO_VIDEO_URL>`
- Source repository: `<REPOSITORY_URL>`

These are placeholders; no external submission has been made.
