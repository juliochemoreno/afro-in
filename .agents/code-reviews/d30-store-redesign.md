# Code review: D30 store redesign

Effort: high (native review run inline, no verify pass). Project checklist: none (`.agents/guides/review-checklist.md` absent). Kept 2 / dropped 2. Validation at review time: `npx tsc --noEmit` clean, `npm test` 120 pass / 0 fail, `npm run check` passes (build + tsc + wrangler dry-run).

## Findings

severity: low
confidence: 90
source: native
file: src/templates/TiendaSlugTemplate.astro
line: 78
issue: SKU label removed from the product page without Julio's decision
detail: The plan flagged the SKU badge as an open question ("drop it unless Julio keeps it"). The redesign dropped it. The cart drawer still shows the SKU, so the two screens now differ.
suggestion: Ask Julio at Level 5; if he wants it back, add a muted `SKU: …` line under the category.

severity: low
confidence: 85
source: native
file: src/templates/CheckoutTemplate.astro
line: 140
issue: Dark form-field styles are a third/fourth copy
detail: Dark input, combobox and phone rules now also live in `CheckoutTemplate.astro` next to `Registration.astro`, `Contact.astro` and `EventoSlugTemplate.astro`. A change to the dark field look needs several edits.
suggestion: D29 (one dark form-field style in `festival.css`) already tracks this; fold the checkout block into it.

## Dropped (low confidence)

- `src/styles/festival.css:87` — `.fz button.fz-button-solid` also restyles any future solid button (confidence 55; grep shows only ProductCard and CheckoutForm use it).
- `src/styles/cart.css:85` — drawer is dark on every page including ones still on the light layout (confidence 55; not checked page by page, no behavior break).
