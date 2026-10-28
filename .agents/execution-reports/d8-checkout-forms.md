# Execution report: D8 — Checkout forms UX

## Meta Information

- **Plan:** `d8-checkout-forms` — `.agents/plans/done/d8-checkout-forms.md`. Spec: `.agents/specs/2026-10-27-checkout-forms.md`.
- **PR:** [#8](https://github.com/juliochemoreno/afro-in/pull/8), merged into `dev` by the orchestrator at 2958d4b. Branch commits: a879bba, d990252, fe1962f, cb94c2f, 2958d4b.
- **Files added:**
  - `scripts/gen-divipola.mjs`, `scripts/gen-dial-codes.mjs`
  - `src/data/divipola.json`, `src/data/dialCodes.ts`
  - `src/lib/checkoutFields.ts`, `src/lib/boldPrefill.ts`
  - `src/components/checkout/{Combobox,PhoneField,LocationFields}.tsx`
  - `src/styles/checkout-fields.css`
  - `tests/checkout-fields.test.ts`, `tests/bold-prefill.test.ts`
  - spec, plan, code review
- **Files modified:**
  - `package.json`, `package-lock.json`
  - `src/components/{CheckoutForm,TicketCheckoutForm,CountryCombobox}.tsx`, `src/components/Registration.astro`
  - `src/templates/{CheckoutTemplate,EventoSlugTemplate}.astro`
  - `src/lib/{orders,tickets}.ts`, `src/pages/api/bold-firma.ts`
  - `src/i18n/locales/{es,en,fr}.json`
  - work list (In flight)
- **Lines changed:** +2417 −329 (30 files, including the 43 KB DIVIPOLA JSON and the docs).

## Validation Results

- Syntax & Linting: Not applicable. The project has no linter.
- Type Checking: ✓ `npm run check` (astro build + tsc + wrangler dry-run) on every commit and on the final branch.
- Unit Tests: ✓ `npm test`, 11 passed, 0 failed (new Node test runner script, no dependency).
- Integration Tests: ✓ curl against `astro dev` with local Bold TEST keys:
  - store: 10 cases (missing or invalid phone, city, address, CO department, bad `countryCode`, no country → 400; valid and AW without department → 201; a client price of 1 still charges the D1 price);
  - tickets: 3 cases;
  - `bold-firma`: 3 cases;
  - `donante` without phone → 201.
- Manual (browser, local): per-field errors and focus in all three forms; CO/US/AW cascades; Bold opens from all three; free ticket redirect; FR and 375 px layout.
- Level 5 (Julio): local and branch Preview, "todo en orden".

## Code Review Findings

- **Code review file:** `.agents/code-reviews/d8-checkout-forms.md` (fresh-context subagent, Opus).
- **Issues found:** 0 critical, 0 high, 2 medium, 4 low.
- **Issues fixed before this report:** 5 (M1, M2, L1, L2, L3). L4 is a release note: tabs opened before the deploy need a reload.
- **Key findings:** the dial code kept following the country after the number was typed, so a wrong `+1` phone could pass. A late geo answer could reset an address already chosen.

## What Went Well

- The Task 0 spike in Bold test mode answered the prefill question before any UI work. It also showed that Bold prefills only after "Pago con tarjeta" is chosen.
- Every data source was verified at planning time (DIVIPOLA counts, `country-region-data` shape, mledoze dial codes), so execution needed no redesign.
- Node 22's `--experimental-strip-types --test` gave real unit tests without a new dependency.
- The hidden-input + bubbling `change` event pattern let the vanilla-JS donation form work with React islands that hydrate later (listeners delegated on `#step1`).

## Challenges Encountered

- CSS specificity: Astro's scoped styles (`.form-group[cid] input[cid]`, 0,3,1) tied the global error rule, and the earlier rule won on order. Fixed with a two-class selector.
- Layout: a `<fieldset>` defaults to `min-inline-size: min-content`, and grid cells default to `min-width: auto`. Long combobox labels pushed the shipping card over the order summary.
- Shared dial codes (+1, +44, +7…) needed a preference table so a pasted number maps to the likely country.

## Bugs Encountered

| Bug | Category | Found By | Severity |
|-----|----------|----------|----------|
| `new URL()` failed in the generators because a `const URL` shadowed the global | other | manual testing | low |
| `node --test tests/` does not accept a directory in Node 22; a glob is needed | other | tests | low |
| Shipping card overflowed over the order summary (fieldset min-content, grid min-width) | styling | manual testing | medium |
| Error border lost to the donation form's scoped input styles | styling | manual testing | low |
| Dial code followed the country after the number was typed (wrong phone passes) | race condition | code review | medium |
| A late geo answer reset an address already chosen | race condition | code review | medium |
| CO department skipped on the client when the DIVIPOLA chunk fails | validation | code review | low |
| A pasted number with another dial code was kept under the current dial | validation | code review | low |
| Pasted +44 picked Guernsey instead of the United Kingdom | other | manual testing | low |
| `countryCode` truncated to 2 characters before validation ("COL" → "CO") | validation | self-review | medium |

## Divergences from Plan

**Phone placeholder**
- **Planned:** keep the existing hints ("Para coordinar la entrega").
- **Actual:** new key `phone.ph` = "300 123 4567" for the number input.
- **Reason:** the hint was cut off in the narrow number input and an example number is clearer.
- **Type:** Better approach found

**One phone error key**
- **Planned:** `checkout.err.phone`, `tix.form.err.phone`, `join.error.phone`.
- **Actual:** a single `phone.err` used by all three forms, plus `checkout.state.select` for the states list.
- **Reason:** same message everywhere. The states key was needed because "Elige el departamento" read wrong for US states.
- **Type:** Better approach found

**Store contact layout**
- **Planned:** email + phone side by side (existing `ck-row`).
- **Actual:** email and phone on full-width rows.
- **Reason:** the dial + number control is too narrow in a half column.
- **Type:** Better approach found

**Errors as derived state**
- **Planned:** `errors` state, revalidated as fields change.
- **Actual:** `errors = attempted ? validate(...) : {}`, computed on each render.
- **Reason:** no effect is needed to keep it in sync, so a whole class of stale-state bugs goes away.
- **Type:** Better approach found

**Notes length**
- **Planned:** `notes ≤ 500`.
- **Actual:** the client caps at 300, which matches the existing server `clean(s.notes, 300)`.
- **Reason:** the plan assumed 500, but the server truncates at 300.
- **Type:** Plan assumption wrong

## Scope Assessment

- **Planned tasks:** 14 (Task 0 spike + 13).
- **Executed tasks:** 14.
- **Unplanned additions:** layout fixes (fieldset/grid overflow, popover min-width) and the dial-code preference table for pasted numbers.
- **Scope accuracy:** On target.

## Skipped Items

- Active-plan pointer `.agents/hopla-active-plan.json` — Reason: the file is not git-ignored in this repo, so it was not written.

## Technical Patterns Discovered

- **Pattern/Gotcha:** global CSS that must beat an Astro component's scoped styles needs at least (0,4,1) specificity. Scoped selectors carry an attribute per compound, e.g. `.form-group[data-astro-cid-x] input[data-astro-cid-x]` is (0,3,1).
  - **Where it applies:** error or state styles shared between React islands and `.astro` forms.
  - **Ready-to-paste entry** (orchestrator.md, project rules): `Global CSS that restyles inputs inside .astro components must beat Astro's scoped selectors (one attribute per compound, e.g. (0,3,1)): use two classes on the wrapper (e.g. .form-group.is-invalid input).`
- **Pattern/Gotcha:** forms built on `<fieldset>` inside a CSS grid need `min-inline-size: 0` on the fieldset and `minmax(0, 1fr)` / `min-width: 0` on the cells. Otherwise long combobox text widens the column.
  - **Where it applies:** checkout and admin forms with comboboxes.
  - **Ready-to-paste entry:** `Grid forms: give <fieldset> min-inline-size: 0 and grid cells min-width: 0 (or minmax(0, 1fr)) so long combobox labels cannot overflow the layout.`
- **Pattern/Gotcha:** Bold's embedded checkout shows `customerData` prefill only after the buyer picks "Pago con tarjeta". The method screen shows nothing. Bold also normalizes a raw `"+57 300 …"` phone.
  - **Where it applies:** any Bold prefill check (Level 5).
  - **Ready-to-paste entry** (orchestrator.md, Release and deploy or Level 5 notes): `Bold prefill (customerData) is only visible after choosing "Pago con tarjeta"; check it there, not on the method screen.`
- **Pattern/Gotcha:** unit tests run with Node's built-in runner: `npm test` = `node --experimental-strip-types --test "tests/**/*.test.ts"` (Node ≥ 22.6). Modules under test must import siblings with a `.ts` extension and no `@/` alias.
  - **Where it applies:** pure logic in `src/lib`.
  - **Ready-to-paste entry** (orchestrator.md, Workers validation line): `npm test runs Node's built-in test runner on tests/**/*.test.ts (no test dependency); tested modules import with ".ts" extensions and no "@/" alias.`

## Recommendations

- **Plan command:** when a phone field "follows" another field, the plan's interaction matrix should cover the order "value typed, then the driver changes" (it missed M1). For any default from an async lookup (geo), state when a late answer must be ignored.
- **Execute command:** the fresh-context review on money paths paid off (2 medium race conditions). Keep it before every PR that touches checkout.
- **orchestrator.md:** add the `npm test` line to the worker validation list, and the Bold prefill Level 5 note above.
