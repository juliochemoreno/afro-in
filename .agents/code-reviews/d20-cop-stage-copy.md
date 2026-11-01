# Code review: d20-cop-stage-copy

Effort: high (native review, 8 angles run inline). Project checklist: none (`.agents/guides` absent). Kept: 2, dropped: 3.

severity: high
confidence: 90
source: native
file: src/pages/api/tickets/stages.ts
line: 38
issue: A pass without stages answered `{state: "ended"}`, so every tier would show as finished.
detail: `getEventBySlug` returns `sale: null` when the event has no stages; `publicSale(null)` mapped that to "ended". If an admin removed the stages, the web would hide the buy button.
suggestion: Answer 404 when `event.sale` is null so the page keeps its date-based tiers.
outcome: fixed

severity: medium
confidence: 85
source: native
file: src/pages/api/tickets/stages.ts
line: 41
issue: The event quota (`soldOut`) was ignored; a stage with leftovers still reported `current`.
detail: `toPublic` caps `remaining` by the event capacity, so the pass can be sold out while the current stage still has quota; the web would keep the buy button.
suggestion: Report `ended` when `event.soldOut`.
outcome: fixed

## Dropped (low confidence)
- src/pages/api/tickets/stages.ts — 404s were uncached and hit D1 on every visit after the event (confidence 60; fixed anyway with a 60 s header).
- src/templates/EventoSlugTemplate.astro:559 — checkout total "$180.000 COP" may wrap at 375 px (confidence 40; Level 5 check).
- src/lib/ticketStages.ts — `loadStagesWithSales` revenue subqueries run on each cache miss (confidence 30; once per 60 s).
