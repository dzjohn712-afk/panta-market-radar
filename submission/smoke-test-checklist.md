# Production smoke-test checklist

Run this against the final public URL after deployment. Items below are manual checks, not claims that a public deployment already exists. Record the URL, time, and observed snapshot values privately without copying credentials.

## Host and liveness

- [ ] Node.js 22.18+; one application replica with a persistent process.
- [ ] Host supplies `PANTA_API_BASE_URL` and `PANTA_API_KEY` server-side.
- [ ] `npm install`, `npm run build`, and `npm start` succeed.
- [ ] `/api/health` returns `{"status":"ok"}` and does not expose configuration.
- [ ] Verify `/api/radar` separately: liveness does not prove Panta credentials or upstream availability.

## Homepage

- [ ] Page loads; title, favicon, and Powered by Panta are visible.
- [ ] Snapshot timestamp and current-sample disclaimer are visible.
- [ ] Live Now works, including honest empty/unavailable states.
- [ ] Prices and volume match `/api/radar` for the same `generatedAt` generation.
- [ ] Recently Resolved works, or explicitly says data is unavailable on discovery failure.
- [ ] Market Pulse labels its observed sample and does not claim global totals.

## Resolution Explorer

- [ ] Category filter works on loaded rows.
- [ ] YES, NO, and Unknown filters work; empty combinations have a clear reset action.
- [ ] Changing filters makes no new upstream/data requests.
- [ ] Rows link to detail pages and label category, outcome, observed volume, and resolution time.

## Live detail

- [ ] Lifecycle is accurate; resolved/cancelled evidence is not shown as normal LIVE.
- [ ] Probabilities, observed volume, and capture timestamp are visible.
- [ ] Trade windows are labeled timestamped activity.
- [ ] Unknown/future timing is unclassified; observed count still includes all rows.
- [ ] A full 200-row response warns of possible truncation.

## Resolved detail and failure semantics

- [ ] A known terminal price pair produces the corresponding YES/NO outcome when present.
- [ ] Missing/ambiguous prices produce RESOLUTION UNKNOWN.
- [ ] Unavailable price is not rendered as 0%; no misleading unavailable-price bar.
- [ ] Unavailable volume is `—`, distinct from genuine numeric zero.
- [ ] Failed activity is unavailable, distinct from a successful empty tape.
- [ ] Regression suite passes for cases the live sample cannot currently demonstrate; do not fabricate a live example.

## Responsive and accessibility

- [ ] Desktop layout has readable spacing and no truncation of essential values.
- [ ] Mobile 390px has no horizontal overflow and visible resolution-field labels.
- [ ] Market links and filter controls work by keyboard.
- [ ] Focus outlines are visible; YES/NO/Unknown are conveyed in text as well as color.

## Security and final validation

- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run check:secrets` pass.
- [ ] Browser assets contain neither `PANTA_API_KEY` nor the configured key value.
- [ ] API responses contain no secrets; production radar responses omit diagnostics.
- [ ] No generic write proxy or wallet/create/buy/claim routes exist.
- [ ] Environment files containing secrets are ignored and absent from Git.
- [ ] `git diff --check` passes; review `git status` before committing.

## Submission handoff

- [ ] Verify the public URL, then replace deployment/repository placeholders in drafts.
- [ ] Record the 2–3 minute demo with current snapshot values.
- [ ] Create/finalize the Colosseum project and add its actual URL.
- [ ] Check the current Panta Sidetrack requirements and submit on Superteam.
