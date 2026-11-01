# Execution report — D13 staged ticket prices (phases 1–4)

## Meta Information

- **Plan:** `d13-staged-ticket-prices`, archived at `.agents/plans/done/d13-staged-ticket-prices.md` with every box ticked or waived with a reason. All 4 phases are done.
- **Branch / PR:** `claude/d13-staged-tickets-0aa889` → `dev`, juliochemoreno/afro-in#13. Commits: `57ab9e0`, `faaa5e0`, `6a9d9dd`, `cc4f713`.
- **Phase 4:** juliochemoreno/afro-in#16 into `dev`: commit `7fafe87`, merge `291655b`. `SALES.tickets.url` now points at `/eventos/pase-afroin-2027-santa-marta`. Julio chose one festival pass for all of Santa Marta, not a single event. Phase 4 is **not in production yet**: it ships with the next `dev` → `main` release.
- **Production release (2026-10-31):** phases 1–3 shipped to production with D18 in release PR juliochemoreno/afro-in#15 (`dev` → `main`, merge commit `58e72d2`), deployed by Workers Builds with Julio's OK. Migration `0011_create_event_price_stages.sql` was applied to the production D1 first, with Julio's OK, and verified: the `event_price_stages` table, the `ticket_orders.stage_id` column and the 3 indexes exist, and existing orders were untouched. The orchestrator's smoke check passed (home, events list and event page in es/en/fr, tickets page, store, admin login).
- **Files added:**
  - `migrations/0011_create_event_price_stages.sql`
  - `src/lib/ticketStages.ts`
  - `tests/ticket-stages.test.ts`
  - `.agents/code-reviews/d13-staged-ticket-prices.md`
  - `.agents/plans/done/d13-staged-ticket-prices.md`
- **Files modified:**
  - `seeds/preview.sql`
  - `src/lib/tickets.ts`, `src/lib/eventAdmin.ts`, `src/lib/orders.ts`
  - `src/pages/api/tickets/checkout.ts`, `src/pages/api/admin/events/index.ts`, `src/pages/api/admin/events/[id].ts`, `src/pages/admin/eventos/[id].astro`
  - `src/components/admin/EventForm.tsx`, `src/components/EventsDashboard.tsx`, `src/components/TicketCheckoutForm.tsx`
  - `src/templates/EventoSlugTemplate.astro`
  - `src/i18n/locales/{es,en,fr}.json`
- **Lines changed:** +1791 −77, in 20 files.

## Validation Results

- **Syntax & Linting:** not applicable; the project has no linter (orchestrator.md).
- **Type Checking:** ✓ `npm run check` (astro build + tsc + wrangler dry-run), run after phase 3 and again after the review fixes. The orchestrator re-ran it on the merge into `dev`.
- **Unit Tests:** ✓ `npm test` 49/49, of which 17 are new stage-logic tests in `tests/ticket-stages.test.ts`.
- **Integration Tests:** ✓ local curl matrix against `astro dev` with a local D1 and fake Bold keys, so no payment was possible. Covered:
  - an unstaged event behaves as before;
  - the stage price is charged and a forged client price is ignored;
  - a quantity above the stage's remaining tickets is refused;
  - a full stage opens the next one early;
  - a stale shown price gets 409 `price_changed`;
  - the "not open yet" and "sold out" states;
  - 3 parallel checkouts for the last seat → exactly one 201;
  - an expired hold frees its seats;
  - an approved order with no tickets yet still holds its seats;
  - a buyer email cannot hold more than 10 unpaid seats;
  - admin create/edit, refusal to delete a stage with orders, a foreign stage id → 400, and no session → 401.
- **Browser (local):** checked the admin stage editor save flow and the public stage list. The checkout form showed the new total after a 409 `price_changed`.
- **Phase 4:** ✓ `npm test` 57/57 and ✓ `npm run check`. In the built HTML the link is `/eventos/…`, `/en/events/…` and `/fr/evenements/…` on the home page and the Santa Marta pages. A missing or hidden event redirects with a 302 to the events list in the visitor's language, so visitors never hit a 404.
- **Level 5 (Julio, branch Preview, Bold TEST mode):** ✓ The orchestrator confirmed TEST purchase order #5 in staging D1: completed, amount 1000 (the stage 1 price), `stage_id` 1, ticket issued. The admin editor and the three languages were also OK.

## Code Review Findings

- **Code review file:** `.agents/code-reviews/d13-staged-ticket-prices.md`, a fresh-context subagent review that included a design review of the money path.
- **Issues found:** 0 critical, 0 high, 2 medium, 6 low.
- **Issues fixed before this report:** 8, in `cc4f713`. The one part left open is #2: a per-IP rate limit, which is a Cloudflare dashboard rule and so Julio's to set.
- **Key findings:**
  - An order that Bold approved but whose tickets were not issued yet was neither held nor sold, so its seats could be sold again.
  - Unpaid 30-minute holds could be abused to lock a cheap stage.

## What Went Well

- Keeping the stage rules in a pure module with no `@/` imports (`ticketStages.ts`) let `node --test` cover every selection and validation rule. The same validator runs in the admin form and on the server.
- The capacity guard is one D1 statement (`INSERT … SELECT … WHERE issued + held + qty <= capacity`, checked through `meta.changes`). It closed the v1 oversell window with no locks or extra tables, and the parallel curl test proved it.
- Saving the event and its stages in a single `db.batch` reused the existing "find the parent by unique key" pattern from `ticketInserts`, so creating an event with stages is atomic.
- All the product questions were settled during planning (9 of them), so there was no product rework during execution.

## Challenges Encountered

- `npm run check` took about 35 minutes the first time in a fresh worktree; the build after that was fast. The 10-minute foreground limit moved it to the background.
- Vite's "Outdated Optimize Dep" (504) broke island hydration in the browser after new imports. It needed an `astro dev --force` restart.
- From a worktree, wrangler 4.21 (`node_modules`) rejects `--env-file` on `d1` subcommands. What worked was `node --env-file=<main>/.env node_modules/wrangler/bin/wrangler.js …`. Under zsh, a command held in a variable is not word-split, so wrap it in a shell function.
- The main checkout has no `.dev.vars`. A temporary one with generated admin secrets and fake Bold keys was enough for the local curl tests; it was deleted afterwards.

## Bugs Encountered

| Bug | Category | Found By | Severity |
|-----|----------|----------|----------|
| Approved order with no tickets issued yet was not counted as held | race condition | code review | medium |
| Unpaid holds could lock a stage (no limit per buyer) | other (abuse) | code review | medium |
| Sold-out stage whose end date had passed did not open the next stage | scope mismatch | code review | low |
| Server read a `null`/`""` stage price as 0 (free) | validation | code review | low |
| Stage delete racing with a new order was skipped silently | race condition | code review | low |
| New checkout errors were Spanish only | other (i18n) | code review | low |
| Fully ended staged event showed the first stage's price | other | code review | low |
| Public stage list put dates in the right column (grid order) | styling | manual testing | low |
| Admin stage price input too narrow in the editor | styling | manual testing | low |

## Divergences from Plan

**Translated checkout errors**

- **Planned:** keep server messages as they were. Task 8 handled only `price_changed`.
- **Actual:** `CheckoutError` in `src/lib/orders.ts` gained an optional `code` and `params`. The checkout returns them, and the form maps each code to `tix.form.err.*` keys in es/en/fr. Added the key `tix.price.free`.
- **Reason:** code review finding #7. `orders.ts` was not in the plan; the change is backward compatible.
- **Type:** Better approach found

**Holds also cover approved orders that have no tickets yet, and are capped per buyer**

- **Planned:** a hold was "pending orders younger than 30 minutes".
- **Actual:** a hold is also `completed AND tickets_issued = 0`, with no time limit. One buyer email can hold at most 10 unpaid seats per event (409 `pending_payment`).
- **Reason:** code review findings #1 and #2.
- **Type:** Security concern

## Scope Assessment

- **Planned tasks:** 9 (8 in phases 1–3, plus Task 9 in phase 4).
- **Executed tasks:** 9.
- **Unplanned additions:**
  - the review fixes (translated error codes, the per-buyer hold cap, the stage oversell log, the 409 on a racing delete);
  - applying the migration and seed to the staging D1;
  - the local `.dev.vars` setup for testing.
- **Scope accuracy:** On target. The code review added a small, bounded amount of work.

## Skipped Items

- **Per-IP rate limit on `/api/tickets/checkout`:** Reason: it is a Cloudflare dashboard rule, which only Julio can set.
- **Production migration `0011`:** not run from this session, because it was Julio's to run. Done 2026-10-31 with Julio's OK, before release PR juliochemoreno/afro-in#15 (see Meta Information).

## Pending for Julio

- **Create the festival pass in the production admin.** Slug `pase-afroin-2027-santa-marta`, name "Pase Festival AFRO IN 2027 · Santa Marta", event date 15 Jan 2027, a description that covers 15–17 Jan. Turn on "Precios por etapas" with three stages:
  - "Registro en afroin.org": 20.000 COP, quota 50, from 1 Nov 2026 to 15 Nov 2026;
  - 35.000 COP from 16 Nov 2026 to 16 Dec 2026;
  - 45.000 COP from 17 Dec 2026, with no end date.

  Keep these dates and prices the same as the static tiers in `src/content/tour2027/santa-marta*.md`. The static tiers decide which tier shows the buy button; the admin stages set the price that is charged. Julio confirmed that the tier 1 note ("registro en afroin.org") stays, because it is the real name of stage 1. Until the event exists, the buy links redirect to the events list.
- **Phase 4 reaches production only with the next `dev` → `main` release.** Until then, production still shows the disabled "Muy pronto" buttons.
- **Optional:** a Cloudflare rate-limit rule on `/api/tickets/checkout` (review finding #2).

## Technical Patterns Discovered

- **Pattern:** an atomic capacity guard in D1.
  - **Where it applies:** any checkout or reservation that sells a limited quantity.
  - **Ready-to-paste AGENTS.md entry:**
    - `- Capacity checks on D1 are a single guarded statement: \`INSERT … SELECT … FROM <parent> WHERE <used> + ?qty <= <capacity>\`, then treat \`meta.changes === 0\` as "sold out". D1 serializes writes, so a read-then-insert check is not enough under concurrent buyers. Count as "used" both issued rows and orders that are paid but not yet issued (\`status='completed' AND tickets_issued=0\`).`
- **Gotcha:** modules imported by `tests/*.test.ts` cannot use the `@/` alias.
  - **Where it applies:** any new logic that should be unit-tested.
  - **Ready-to-paste AGENTS.md entry:**
    - `- Logic you want covered by \`npm test\` goes in an alias-free module (relative \`.ts\` imports only, no \`@/\`, no D1): \`node --experimental-strip-types --test\` cannot resolve the \`@/\` path alias. Example: \`src/lib/ticketStages.ts\`.`
- **Gotcha:** wrangler from a worktree.
  - **Where it applies:** staging D1 migrations or commands run from `.claude/worktrees/*`.
  - **Ready-to-paste entry for `.agents/orchestrator.md`, rule 8:**
    - `If \`--env-file\` is rejected ("Unknown arguments: env-file"), run wrangler through node instead: \`node --env-file=<main checkout>/.env node_modules/wrangler/bin/wrangler.js d1 …\`. In zsh, wrap it in a function: a command stored in a variable is not word-split.`
- **Gotcha:** `astro dev` "Outdated Optimize Dep" (504).
  - **Where it applies:** after adding new imports to React islands during a dev session.
  - **Ready-to-paste entry:**
    - `- If islands stop hydrating in \`astro dev\` with "504 Outdated Optimize Dep", restart with \`npx astro dev --force\`. A browser reload alone does not fix it.`

## Recommendations

- **Plan command:** when a plan adds holds or reservations, list every order state that occupies capacity (pending, paid-not-issued, issued) in the plan's Domain Assumptions. That would have caught finding #1 during planning.
- **Execute command:** run the fresh-context money-path review before phase 3 (UI), not after. The fixes were all server-side and could have landed in the phase 2 commit.
- **AGENTS.md / CLAUDE.md additions:** the four entries above. Also document that the main checkout has no `.dev.vars`, and that a generated local one, deleted afterwards, is enough for curl tests.
