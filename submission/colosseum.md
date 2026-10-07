# Colosseum submission draft

Preparation draft only. Confirm the current submission form and requirements before submitting.

## Project name

Panta Market Radar

## One-line description

Live Market & Resolution Intelligence: a read-only dashboard that turns the current Panta API sample into clear probabilities, activity, and resolution context.

## Short project description

Panta Market Radar helps users inspect live prediction markets and browse sampled recent resolutions. It combines detail-derived prices, trade-derived activity, market metadata, category/outcome filters, and sample-level Market Pulse summaries. Each view explains its snapshot and preserves unavailable data.

## Problem

Sparse catalogs and changing market state make prediction-market discovery difficult. Missing data can look deceptively like zero activity or a zero probability, while catalog rows may conflict with current detail evidence.

## Solution

A focused monitor with Live Now, a Recent Resolution Explorer, and individual market intelligence pages. Local validation, explicit uncertainty, and capture timestamps make the observed sample easier to understand.

## How Panta API is used

`GET /markets/` supplies bounded catalog samples. `GET /markets/{marketId}/` supplies current prices and lifecycle evidence. `GET /markets/{marketId}/trades/` supplies active-market activity. The API key stays on the server. Resolved discovery has a bounded unfiltered fallback and outcomes are inferred only from unambiguous detail prices.

## Technical implementation

Next.js App Router and TypeScript with a server-only GET client, runtime normalization, a 150-second cache, process-local in-flight coordination, and bounded enrichment. Filtering uses already loaded data. The product requires one Node application instance and no database or wallet.

## Why it is different

It remains useful with very few active markets by pairing a live monitor with a resolution explorer. It shows the current observed sample and preserves uncertainty instead of claiming global coverage, inventing liquidity, or offering unsupported price-history metrics.

## Potential future direction

As API coverage develops, expand supported discovery and improve source-quality explanations. Any future capability would depend on documented API data and be evaluated separately from the current MVP.

## Links to complete

- Deployment: `<DEPLOYMENT_URL>`
- Source repository: `<REPOSITORY_URL>`
- Demo video: `<DEMO_VIDEO_URL>`

No deployment, usage traction, or external submission is claimed by this draft.
