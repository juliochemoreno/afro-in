# Execution report: D23 — multi-day events (end date) + desktop tickets page

## Meta Information

- **Plan:** `d23-event-end-date` — `.agents/plans/done/d23-event-end-date.md`
- **PR:** [juliochemoreno/afro-in#24](https://github.com/juliochemoreno/afro-in/pull/24) into `dev`, merged by the orchestrator as `904d34a` (head `cd641f8`, CI green).
- **Branch commits:**
  - `f65a163` phase 1
  - `ae668ce` record 0012 in production
  - `5ccb2ad` keep end_date on old-tab saves
  - `aa8a100` merge of dev (PR #23)
  - `3a185b7` phase 2
  - `c35592f` desktop tickets page
  - `cd641f8` review fixes
- **Files added:**
  - `migrations/0012_add_event_end_date.sql`
  - `src/lib/eventColumns.ts`
  - `tests/event-columns.test.ts`
  - `.agents/code-reviews/d23-event-end-date.md`
  - the plan
- **Files modified:**
  - `src/lib/ticketStages.ts`, `src/lib/tickets.ts`, `src/lib/eventAdmin.ts`, `src/lib/eventDisplay.ts`, `src/lib/mainMenu.ts`
  - `src/pages/api/admin/events/[id].ts`
  - `src/components/admin/EventForm.tsx`, `src/components/EventsDashboard.tsx`, `src/components/TicketQR.tsx`, `src/components/TicketList.tsx`, `src/components/TicketReceipt.tsx`
  - `src/templates/EntradasTemplate.astro`, `src/templates/EventoSlugTemplate.astro`, `src/templates/EventosIndexTemplate.astro`
  - `tests/ticket-stages.test.ts`, `tests/event-display.test.ts`, `tests/main-menu.test.ts`
  - `.agents/plans/2026-10-27-work-list.md`
- **Lines changed:** +967 −163 (23 files, `git diff --stat 904d34a^1 904d34a`)

## Post-release step for Julio (production)

1. Migration `0012` is **already applied** in production. Julio ran it on 2026-11-01, and it was verified read-only: `end_date TEXT` exists on `events`. Do not run it again.
2. After the end-of-day `dev` → `main` release, in the production admin:
   - edit **"Pase Festival AFRO IN 2027 · Santa Marta"** (`pase-afroin-2027-santa-marta`);
   - set **"Último día" = 17/01/2027** and save.
   - Until then, the pass behaves as it does today (on sale until 15 Jan 21:00). That is fine before 15 Jan.
3. Expected result after step 2:
   - the list card shows `Hasta dom 17 · 9:00 p. m.`;
   - the page header shows `Vie 15 – Dom 17 Ene 2027`;
   - the pass stays visible and on sale until 17 Jan 23:59 Bogotá time.

## Validation Results

- **Syntax & Linting:** not applicable. The repo has no linter.
- **Type Checking:** ✓. `npm run check` (astro build + tsc + wrangler dry-run) exits 0 on `cd641f8`.
- **Unit Tests:** ✓. 75 passed, 0 failed. The orchestrator also got 75/75 on `904d34a`.
- **Integration Tests:**
  - ✓ Staging D1 through the branch Preview, phase 1:
    - the ongoing multi-day event is listed, its page returns 200 in es/en/fr, and checkout creates the order;
    - an ended multi-day event and a past one-day event are hidden, their page redirects (302), and checkout answers "El evento no está disponible";
    - the SQL cutoff expression was checked directly on staging D1.
  - Phase 2 and the desktop page were checked on a local `astro dev` server, at 1440px and 375px.
- **Human review:** ✓ Julio, on a local server, approved on 2026-11-01.

## Code Review Findings

- **Code review file:** `.agents/code-reviews/d23-event-end-date.md`
- **Issues found:** 0 critical, 0 high, 3 medium, 7 low, across two reviews: phase 1, then the full branch with fresh context.
- **Issues fixed before this report:**
  - 3 medium: the release order was documented, the stale end date on old-tab saves was fixed, and the receipt width was fixed;
  - 1 low: an empty `end_date` in the SQL is now treated as none.
- **Key findings:**
  - Code that reads `end_date` must not deploy before `0012`. It did not: Julio applied `0012` first.
  - An admin tab without the field could keep a last day that ends before the new start date. It is now cleared on save.

## What Went Well

- The stage logic never read `event_date`. The last open-ended stage already ran "until the event", so prices needed no change. Only the three gates did: the list, the event page and the checkout.
- `SELECT e.*` carried `end_date` to the tickets page, the confirm API and the admin grid with no query changes.
- Pure helpers with no `@/` imports kept every date rule and format unit-tested in es/en/fr.
- A spike on `Intl.formatRange` showed es-CO prints "15 a 17 de ene de 2027". That led to building ranges from parts before any UI code was written.

## Challenges Encountered

- **Design iterations.** The approved "días con guion" range (`vie–dom / 15–17`) looked wrong once rendered. Julio changed it to "3 días" on the stub and to the start-day block plus "Hasta dom 17" on the cards.
- **Review workflow.** Julio moved Level 5 from the branch Preview to local, with production in one step at the end of the day. Local D1 needed `--env local`, because `astro dev` reads a different local database than plain `--local`.
- **Overlap with PR #23.** Phase 2 had to wait for PR #23. The merge was clean because phase 1 left those files alone.
- **Migration attempts.** Julio's first two production migration attempts ran from the worktree, which has no `.env`. Nothing reached production. The command needs the absolute `--env-file` path.

## Bugs Encountered

| Bug | Category | Found By | Severity |
|-----|----------|----------|----------|
| Empty-string `end_date` would keep an event listed forever in SQL but 404 its page | validation | code review | low |
| Old admin tab moving an event later kept a stale last day before the new start | validation | code review | medium |
| 940px desktop width applied to pending/failed receipts too | styling | code review | medium |
| Typed `.first<T>()` on an untyped `db` failed tsc | type error | types | low |

## Divergences from Plan

**Card and stub display**
- **Planned:** the gold block shows `vie–dom / 15–17 / ene` on both the cards and the stub.
- **Actual:**
  - cards keep the start-day block and add `Hasta dom 17` beside the time;
  - the stub block shows `3 / días`;
  - `calParts` lost its range mode;
  - new helpers `untilDate` and `eventDays` were added.
- **Reason:** Julio saw the rendered result and preferred these.
- **Type:** Other (product decision)

**Old admin tab keeps `end_date`**
- **Planned:** a save from an old tab clears `end_date`, and Julio refreshes the admin first.
- **Actual:** the PUT skips `end_date` when the key is missing. The column mapping moved to `src/lib/eventColumns.ts` so it can be tested. A stale value that ends before a new start date is cleared.
- **Reason:** the orchestrator's request, plus a finding from the review.
- **Type:** Better approach found

**Level 5 location**
- **Planned:** branch Preview.
- **Actual:** local `astro dev` on port 4323.
- **Reason:** Julio's instruction.
- **Type:** Other

**Production migration timing**
- **Planned:** applied before the release.
- **Actual:** Julio applied it during execution, before any merge.
- **Reason:** his choice. The migration is additive.
- **Type:** Other

## Scope Assessment

- **Planned tasks:** 11.
- **Executed tasks:** 11.
- **Unplanned additions:**
  - two-column tickets page on desktop (Julio, "Do it here");
  - keep `end_date` on old-tab saves (orchestrator).
- **Scope accuracy:** under-scoped. There were two visual iterations, which matches the budgeted "Expected UX iterations: 2", and one extra feature.

## Skipped Items

- Manual admin click-through of the "Último día" field. Reason: the admin login was not exercised. The logic is covered by tests that run the same function on client and server, and Julio uses the field in production after the release.

## Technical Patterns Discovered

**`astro dev` reads the `env.local` D1**
- **Pattern/Gotcha:** `astro dev` reads the `env.local` D1, so local migrations and seeds need `--env local`. Plain `--local` writes to a different local database that the dev server never reads.
- **Where it applies:** any local D1 setup in this repo.
- **Ready-to-paste AGENTS.md entry:** `- Local D1 for astro dev: run migrations and seeds with --local --env local (npx wrangler d1 migrations apply DB --local --env local; ... d1 execute DB --local --env local --file seeds/preview.sql). Plain --local writes a different local database that astro dev never reads.`

**Production D1 from a worktree**
- **Pattern/Gotcha:** a worktree has no `.env`, so `--env-file=.env` fails there.
- **Where it applies:** commands handed to Julio for production.
- **Ready-to-paste AGENTS.md entry:** `- Production D1 commands handed to Julio: give the absolute env path (node --env-file=/Users/juliochemoreno/Projects/personal/afroin-web/afro-in/.env node_modules/wrangler/bin/wrangler.js d1 execute afroin --remote --file migrations/NNNN_x.sql), since a worktree has no .env.`

**`Intl.formatRange` is not a house format**
- **Pattern/Gotcha:** `Intl.formatRange` with es-CO gives "15 a 17 de ene de 2027", which is not the house style. Ranges are built from parts in `src/lib/eventDisplay.ts`.
- **Where it applies:** any new date display.
- **Ready-to-paste AGENTS.md entry:** `- Event dates: use src/lib/eventDisplay.ts helpers (calParts, kickerDate, shortDateRange, untilDate, eventDays); never Intl.formatRange (es-CO renders "15 a 17 de ene de 2027").`

**Columns added after the admin form shipped**
- **Pattern/Gotcha:** a new column in an admin full-row PUT is cleared by tabs opened before the release.
- **Where it applies:** new event or product columns.
- **Ready-to-paste AGENTS.md entry:** `- New events columns edited in the admin: add them to KEEP_WHEN_MISSING in src/lib/eventColumns.ts so a tab opened before the release does not clear them.`

## Recommendations

- **Plan command:** when a plan specifies a visual format (a range inside a fixed-width block), show a rendered mock before approval. Text previews hid how cramped `31-2` would look.
- **Execute command:** ask early whether Level 5 runs locally or on the Preview. This project now prefers local.
- **AGENTS.md / CLAUDE.md additions:** the four entries above.
