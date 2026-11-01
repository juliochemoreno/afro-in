> **Status:** done. Merged into dev 2026-11-01 ([PR #18](https://github.com/juliochemoreno/afro-in/pull/18), merge 9940816, head 4e58b02). Not in production yet: ships with the next `dev` → `main` release. Execution report: `.agents/execution-reports/d20-cop-stage-copy.md`.

# Plan: D20 — COP always visible, stage 1 copy, current tier follows real stages

## Overview
Three small changes, es/en/fr. (1) Every public price reads "$20.000 COP" (one shared formatter, same size). (2) Stage 1 period copy becomes "until 15 Nov or until the 50 tickets sell out". (3) The current tier of the prerendered programacion pages follows the real stages of the production pass (`pase-afroin-2027-santa-marta`) through a small cached public endpoint, with the date-based tier as fallback. No page becomes server-rendered.

## Requirements Summary
- Julio approved: format "$20.000 COP", COP glued to the number, same size (no small suffix). Admin screens stay as they are.
- Julio approved: point 3 option A (endpoint + script, no SSR). Orchestrator conditions, accepted by Julio: (1) request fails/slow → keep the date-based tier, no blank or wrong flash; (2) endpoint exposes only which stage is current (id/price/state), never remaining or sold counts; (3) response cached ~60 s.
- Stage 1 note keeps "registro en afroin.org" (the real stage name).
- Workflow classification: tier display is `async data-arrival` (client fetch refines a server-rendered default); everything else is static rendering.

## Out of Scope
- Admin dashboards/forms (`*Dashboard.tsx`, `admin/EventForm.tsx`): keep `Intl` es-CO.
- JSON-LD in `Layout.astro` (membership, USD), `Registration.astro` donation amounts (already "$20.000 COP"/"~20,000 COP" with USD context), `join.description`.
- Any other copy or product decision; production data; main.
- Changing checkout/stage logic (`stageStatuses` is reused as is).
- Expected UX iterations: 2 (spacing/wrapping of the longer price string on tier cards, event cards and checkout total).

## Likely Follow-ups
- Show "agotada"/sold-out flag on tier 1 (needs exposing more data; rejected by condition 2).
- Locale-specific COP wording (e.g. "pesos colombianos" in en/fr).

## Git Strategy
- **Base branch:** `dev` (worktree branch `claude/d20-cop-stage-copy-461ba8`, already merged with `origin/dev`)
- **Feature branch:** `claude/d20-cop-stage-copy-461ba8`; one PR into `dev`.

## Context References (verified in this session)
- `src/lib/programacion.ts:119-145` — `SALES.tickets.url = "/eventos/pase-afroin-2027-santa-marta"`; `tierStage`, `bogotaToday`; `formatCop(amount, lang)` uses `Intl` currency COP → "$ 20.000".
- `src/components/EditionTickets.astro` — price `{formatCop(...)} <span class="fz-tier-cur">COP</span>`; script on `astro:page-load` sets `data-stage`, hides/shows flags and buy button by date (the only place tiers pick "current"). Used by `Edition2027IndexTemplate.astro:189` and `Edition2027StopTemplate.astro:186`.
- `src/components/Events.astro` (home) — only a link to the pass (`SALES.tickets.url`), no tiers: nothing to change for point 3.
- `src/pages/programacion/**` — no `prerender` export, `output: "static"` (astro.config.mjs:16) ⇒ prerendered. `src/pages/eventos/[slug].astro:2` is `prerender = false` (SSR).
- `src/lib/ticketStages.ts` — `stageStatuses`, `resolveSale` (stage opens early when previous is sold out/held); `bogotaToday`.
- `src/lib/tickets.ts:120` `loadStagesWithSales(db, eventIds)`, `:251 getVisibleEvents`, `:270 getEventBySlug` (visible, not past, returns `stages` with `status`, `remaining`).
- `src/pages/api/contador.ts` — pattern for a public cached JSON API (`prerender = false`, `Cache-Control: public, max-age=60`).
- Price renderers (public): `src/lib/cart.ts:134 formatPrice` (es-CO, "$ 20.000"; used by `CheckoutForm.tsx`, `OrderReceipt.tsx`, `CartWidget.astro`, `TicketCheckoutForm.tsx`, `EventoSlugTemplate.astro`, `EventosIndexTemplate.astro`); `src/lib/products.ts:57 formatPrice` (strips spaces; `ProductCard.astro`, `TiendaSlugTemplate.astro`); `src/lib/activitySignup.ts:16` appends ` COP` after `formatCop` (would duplicate).
- Separate "COP" spans to remove: `EventoSlugTemplate.astro:188,203` (`fz-tier-cur`), `TicketCheckoutForm.tsx:301` (`tix-cur`) + CSS `EventoSlugTemplate.astro:565`, `EventosIndexTemplate.astro:125` (`ev-cur`) + CSS `:296`, `festival.css:130` (`.fz-tier-cur`, still used by tiers? remove if unused after changes).
- Copy: `src/content/tour2027/santa-marta{,.en,.fr}.md` tier 1 `period` (lines ~99 en/fr; es under `tickets.tiers`). `palenque*.md` has no tickets block (verified: `grep tickets` empty).
- Tests: `tests/programacion.test.ts:107-109` assert old `formatCop` output; `tests/ticket-stages.test.ts` for stage logic.
- Re-verify at execution start: `grep -rnE "formatCop|formatPrice|fz-tier-cur|tix-cur|ev-cur" src tests` (hit list above is the baseline).

## Domain Assumptions (confirm before execution)
- A tier of the md is matched to a real stage by **price** (20.000/35.000/45.000 are unique). If the endpoint's current price matches no tier (e.g. admin changed a price), the page keeps the date-based tier.
- Endpoint states: `current` (tiers before the matching one → "finalizada", matching → current + buy button, after → upcoming); `upcoming` (no current tier, buy hidden); `ended` (all finalizada, no buy). If all stages are sold out the pass reports `ended`/`upcoming` per `resolveSale`, so the web stops offering the buy button. Confirm this is what you want when stage 3 sells out.
- Up to 60 s of staleness is accepted; the checkout stays authoritative (it already refuses with `price_changed`).
- The endpoint always serves the pass in `SALES.tickets.url` (slug derived from it); it takes no query parameter, so it cannot be used to probe other events or bypass the cache.
- New copy (en/fr equivalents of "Hasta el 15 de noviembre o hasta agotar las 50 boletas"):
  - en: "Until November 15 or while the 50 tickets last"
  - fr: "Jusqu'au 15 novembre ou jusqu'à épuisement des 50 billets"
- Number grouping stays per language (es "$20.000 COP", en "$20,000 COP", fr "$20 000 COP"); `$` prefix and ` COP` suffix in all three.

## Phase Boundaries (single PR, 2 commits)
- **Commit 1 — COP + copy (Tasks 1-4):** `tests/programacion.test.ts` (updated) lands here.
- **Commit 2 — stage-aware tiers (Tasks 5-8):** `tests/ticket-stages.test.ts` + `tests/programacion.test.ts` additions land here (green at commit).
- Rollback: revert the commit (commit 2 alone leaves the date-based tiers intact).

## Implementation Tasks

### Task 1: Shared COP formatter
- **Action:** create `src/lib/money.ts` and modify `src/lib/programacion.ts`, `src/lib/cart.ts`, `src/lib/products.ts`
- **File:** `src/lib/money.ts`
- **Pattern:** `src/lib/ticketStages.ts` (pure, no `@/` imports so tests can load it)
- **Details:** `formatCopAmount(amount, locale)` → `"$" + Intl.NumberFormat(locale, {maximumFractionDigits: 0}).format(amount) + " COP"` (non-breaking space before COP, ` `, so it never wraps alone). `programacion.formatCop(amount, lang)` delegates with `LOCALES[lang]`; `cart.formatPrice` and `products.formatPrice` delegate with `es-CO` (keep their exported names and signatures). Use non-breaking space also inside fr grouping as Intl does.
- **Gotcha:** `products.formatPrice` strips whitespace today — drop that, otherwise "$20.000COP". `TicketCheckoutForm` interpolates `formatPrice` into the `price_changed` message: fine, now includes COP.
- **Validate:** `npx tsx -e` or the test in Task 8; `npm run check`.

### Task 2: Remove the separate COP spans and the duplicate suffix
- **Action:** modify
- **File:** `src/components/EditionTickets.astro`, `src/templates/EventoSlugTemplate.astro`, `src/templates/EventosIndexTemplate.astro`, `src/components/TicketCheckoutForm.tsx`, `src/lib/activitySignup.ts`, `src/styles/festival.css`
- **Pattern:** N/A
- **Details:** delete the `<span class="fz-tier-cur|ev-cur|tix-cur">COP</span>` elements (and the `s.price > 0 &&` wrappers); remove orphaned CSS (`.fz-tier-cur`, `.ev-cur`, `.tix-cur`) after confirming with grep; `activitySignup.ts`: use `formatCop(...)` alone (no extra ` COP`). Free events keep `t("tix.price.free")` with no COP.
- **Gotcha:** big price font sizes (26px/display) now include the suffix: check wrapping at 375 px (`white-space: nowrap` exists on `.ev-price`; verify the tier card and checkout total).
- **Validate:** `grep -rnE "fz-tier-cur|tix-cur|ev-cur" src` → 0 hits; `npm run check`.

### Task 3: Stage 1 copy es/en/fr
- **Action:** modify
- **File:** `src/content/tour2027/santa-marta.md`, `santa-marta.en.md`, `santa-marta.fr.md`
- **Pattern:** N/A
- **Details:** tier 1 `period` → es "Hasta el 15 de noviembre o hasta agotar las 50 boletas"; en/fr per Domain Assumptions. Keep `from`/`until`, `price`, and the `note` ("…registro en afroin.org", unchanged).
- **Gotcha:** `period` is shown verbatim, longer text: check card layout.
- **Validate:** `grep -n "15 de noviembre\|November 15\|15 novembre" src/content/tour2027/santa-marta*.md`.

### Task 4: Update existing tests for the new format
- **Action:** modify
- **File:** `tests/programacion.test.ts`
- **Pattern:** existing assertions at lines 107-109
- **Details:** `formatCop(20000,"es")` matches `/^\$20\.000 COP$/`; en `$45,000 COP`; fr `$35 000 COP` (accept Intl's narrow nbsp in grouping).
- **Gotcha:** Node ICU data for fr; use a regex tolerant to `\s` variants.
- **Validate:** `npm test`.
- *Commit 1 here (tasks 1-4).*

### Task 5: Pure helpers for the public sale and the tier mapping
- **Action:** modify
- **File:** `src/lib/ticketStages.ts`, `src/lib/programacion.ts`
- **Pattern:** `resolveSale` in `ticketStages.ts`
- **Details:** `publicSale(stages, today)` → `{ state: "current"|"upcoming"|"ended", current?: {id, price} }` built from `resolveSale` (no counts). `programacion.ts`: `tierStagesFromSale(tiers, sale, today)` → per-tier `TierStage`: if `sale` is valid and its price matches exactly one tier → tiers before it `past`, it `current`, after `upcoming`; `state:"upcoming"` → no `current` (those not past by date stay upcoming); `state:"ended"` → all `past`; no match / invalid → `tierStage(today, from, until)` per tier (today's behavior).
- **Gotcha:** `programacion.ts` must not import `ticketStages` server-side logic into the client bundle beyond types.
- **Validate:** Task 8 tests.

### Task 6: Public endpoint
- **Action:** create
- **File:** `src/pages/api/tickets/stages.ts`
- **Pattern:** `src/pages/api/contador.ts`; `getEventBySlug` in `src/lib/tickets.ts:270`
- **Details:** `prerender = false`, GET only. Slug = last segment of `SALES.tickets.url`. Load the event and its stages (`getEventBySlug` returns stages with sales; reuse it, no new SQL), respond `{ state, current: {id, price} | null }` computed by `publicSale(event.stages, bogotaToday())`. Event missing/hidden → `{ state: "ended", current: null }`? No: return 404 so the page keeps the date-based tier. Cache ~60 s: `Cache-Control: public, max-age=60, s-maxage=60`, plus Workers Cache API (`caches.default` keyed on the fixed URL) so D1 is not hit on every visit (try/catch, fall back to no cache).
- **Validation:** no input; method GET only; no query params read.
- **Error UX:** on any error respond 5xx with `Cache-Control: no-store`; the page ignores it and keeps the date-based tier.
- **Gotcha:** never include `remaining`, `sold`, `held`, `capacity`, names or revenue in the payload (condition 2); `getEventBySlug` returns null for past/hidden events. Spike: confirm on the Preview that the second call returns from cache (`cf-cache-status` or response timing) — if the Cache API is unavailable on the adapter, fall back to headers only and report.
- **Time-box:** 30 min for the Cache API; fallback: Cache-Control headers only.
- **Validate:** `curl -i <preview>/api/tickets/stages` twice; inspect JSON keys.

### Task 7: Script in `EditionTickets.astro`
- **Action:** modify
- **File:** `src/components/EditionTickets.astro`
- **Pattern:** the existing `showStages` on `astro:page-load` (keep it first; it renders the date-based state immediately)
- **Details:** after `showStages()`, `fetch("/api/tickets/stages")` with `AbortController` timeout (3 s); on a valid response compute `tierStagesFromSale` over the `<li data-from data-until data-price>` (add `data-price={tier.price}`) and re-apply the same flags/buy button. Ignore any error/timeout silently. Guard against stale writes on client-side navigation (check the list is still in the DOM).
- **Gotcha:** scripts must run on `astro:page-load` (project rule); one request per page load shared by all `[data-tiers]` lists (home of the stop and the 2027 index can have two).
- **Validate:** manual on the Preview (Level 5).

### Task 8: Tests for the new logic
- **Action:** modify
- **File:** `tests/ticket-stages.test.ts`, `tests/programacion.test.ts`
- **Pattern:** existing tests in both files
- **Details:** `publicSale`: stage 1 sold out before 15 Nov ⇒ `current` is stage 2 (price 35000) and payload has no extra keys; upcoming; ended. `tierStagesFromSale`: stage 1 sold out ⇒ tier 1 `past`, tier 2 `current`; price without match ⇒ date fallback; `null` sale ⇒ date fallback.
- **Gotcha:** payload shape asserted with `deepEqual` to lock condition 2.
- **Validate:** `npm test`.
- *Commit 2 here (tasks 5-8).*

## Test Tasks
Tasks 4 and 8. Regression: smoke the checkout (`/eventos/pase-afroin-2027-santa-marta` buy box, total, price-changed message), store card/cart and order receipt for the new "$X COP" string.

## Validation Checklist
- [x] **Level 1/2:** `npm run check` — passed after the last review fix.
- [x] **Level 2.5:** `.agents/code-reviews/d20-cop-stage-copy.md` (2 kept, both fixed in `4e58b02`).
- [x] **Level 3:** `npm test` — 59/59 (re-run by the orchestrator on the merge).
- [x] **Level 4 (waived, reason):** the pass `pase-afroin-2027-santa-marta` exists only in production, so the Preview endpoint answers 404 (the date-based fallback); payload keys are locked by the `publicSale` `deepEqual` test and the `Cache-Control: public, max-age=60` header is set in code. `curl -i` the endpoint on the branch Preview twice (payload keys, cache headers)
- [x] **Level 5 (Julio, before merge) — done, "D20 ok":** on the Preview, 375 px and desktop, es/en/fr: tiers on `/programacion/2027` and `/programacion/2027/santa-marta`, `/eventos` list and the pass page, checkout total, store card; endpoint failing (block the request in devtools) keeps the date-based tier. If skipped, the wrapping of longer prices ships unobserved. "Stage 1 sold out ⇒ tier 2 shown" is NOT testable without touching production data; it is covered by unit tests only (a Preview D1 test is out of scope).

## Acceptance Criteria
- [x] No public price renders without "COP" or with "$ 20.000" spacing (grep + visual check).
- [x] Tier 1 period reads the new copy in es/en/fr; note still says "registro en afroin.org".
- [x] With the endpoint blocked/slow, tiers show exactly as today (by date).
- [x] Endpoint payload contains only `state` and `current.{id,price}` (unit test); response cached ~60 s via header — the Cache API layer is best effort and unobserved in production (waived).
- [x] `npm run check` and `npm test` pass.

## Confidence Score: 8/10
- **Strengths:** only the tier script decides "current"; endpoint reuses tested stage logic; no SSR change.
- **Uncertainties:** Workers Cache API on this adapter; wrapping of longer price strings.
- **Mitigations:** time-box with header-only fallback; Level 5 on the Preview at 375 px.

## Notes for Executing Agent
- Never read `.env`; never touch production data or `main`. Commit on the work branch, PR into `dev`, no merge to `main`.
- Expected UX iterations: 2. UI proposals are provisional.
