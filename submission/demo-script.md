# Demo script — approximately 2 minutes 45 seconds

Rehearse with the actual current snapshot. Substitute the observed category, outcome, and values; do not promise a fixed market count. Record the product interface rather than a terminal walkthrough.

## 0:00–0:20 — Problem and product

“Prediction-market APIs can be sparse, inconsistent, and fast-moving. This is Panta Market Radar: Live Market & Resolution Intelligence. It makes the current Panta API sample easier to inspect while keeping missing data and uncertainty visible.”

Show the homepage title, snapshot timestamp, and Powered by Panta attribution.

## 0:20–0:45 — Live Now

“Live Now shows the active markets we observed in a bounded catalog sample. We validate lifecycle locally, rather than relying only on the API's status filter. Even with a small active sample, the page remains useful through recent resolutions and Market Pulse.”

Point to a live card. If none are available, show the honest empty state and explain that the product follows the current sample.

## 0:45–1:15 — Probability and activity

“YES and NO probabilities come from the market detail endpoint, not catalog list prices. Recent activity comes from the trade endpoint. These counts classify only valid timestamps. Unknown or future timing remains unclassified, and a failed request is unavailable rather than zero. Every value reflects the response captured for this snapshot.”

Point to prices, observed volume, and activity. Read only the values actually visible; show unavailable state naturally if encountered.

## 1:15–1:45 — Recently Resolved and filters

“The Resolution Explorer lets us browse recent resolved markets in the loaded sample. I can filter by category and YES, NO, or Unknown outcome without making new API requests. Unknown means the captured detail prices did not provide an unambiguous outcome. This is a sampled view, not the complete Panta history.”

Change one category and one outcome filter, then restore All if the combination is empty.

## 1:45–2:10 — Market detail

“Opening a market gives us its lifecycle, metadata, observed volume, and dates. Active markets also show trade activity. This page has its own capture timestamp, so its response can differ from an earlier homepage snapshot. Missing values stay unavailable.”

Open one market row; briefly point to the state, prices, and timestamp.

## 2:10–2:30 — Integration and architecture

“The integration uses Panta's catalog, market detail, and trade endpoints. Requests run server-side, with the API key kept out of the browser. Discovery and enrichment are bounded, and a shared cache plus process-local coordination limits repeated work. The app is read-only.”

Return to Market Pulse; keep the product visible.

## 2:30–2:45 — Close

“Panta Market Radar turns the current sample into useful live and resolution context. It helps users see what is happening—and what is unknown—without overstating coverage. Powered by Panta.”
