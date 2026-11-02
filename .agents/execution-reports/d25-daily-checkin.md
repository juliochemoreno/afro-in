# Execution Report: D25 — Multi-day events: one check-in per day

## Meta Information

- **Plan:** `d25-daily-checkin` — `.agents/plans/done/d25-daily-checkin.md`
- **PR:** [PR #28](https://github.com/juliochemoreno/afro-in/pull/28), commit 1541fe3, merged into `dev` as adfa97d
- **Files added:**
  - `migrations/0014_create_ticket_checkins.sql`
  - `src/lib/doorDay.ts`
  - `tests/door-day.test.ts`
  - `.agents/code-reviews/d25-daily-checkin.md`
  - `.agents/plans/d25-daily-checkin.md`
- **Files modified:** `src/lib/tickets.ts`, `src/components/CheckinScanner.tsx`, `src/components/TicketOrdersDashboard.tsx`
- **Lines changed:** +526 −18 (including the plan and the review, 209 lines)

## Validation Results

- **Syntax & Linting:** not applicable. The repo has no lint script.
- **Type Checking:** ✓ `npm run check` (astro build, tsc and a wrangler dry-run). `tsc --noEmit` ran again after syncing with `origin/dev`, which was already up to date.
- **Unit Tests:** ✓ 104 passed, 0 failed, including 7 new door-day tests.
- **Integration Tests:** ✓ run against the real local D1 (miniflare, `getPlatformProxy` with `environment: "local"` and `remoteBindings: false`). `checkInTicket`, `getTicketOrderByToken` and `getTicketOrderDetailForAdmin` were bundled with esbuild and called with simulated times. Every branch was exercised, including one concurrent double scan, which gave one `ok` and one `already`. The `0014` backfill was run twice and is idempotent.
- **Human (Level 5):** ✓ Julio tested the scanner on local `astro dev` (port 4326): "ya hice la prueba todo ok".

## Code Review Findings

- **Code review file:** `.agents/code-reviews/d25-daily-checkin.md`, a fresh-context review by a separate agent
- **Issues found:** 0 critical, 0 high, 2 medium, 3 low, 1 note
- **Issues fixed before this report:** 2
  - Backfill of check-ins made before the release.
  - Admin dates shown in Bogotá time.
  - The deploy order is documented, and the remaining findings are recorded as known limits.
- **Key findings:**
  - Without a backfill, a multi-day ticket checked in under the old one-entry rule could enter twice on the same day.
  - The code must not reach production before `0014`. Multi-day pages and scans fail with "no such table" otherwise.

## What Went Well

- **Decisions:** Julio settled the open questions one at a time:
  - the door day rolls over at 6 a.m.;
  - the admin shows entries per day;
  - the buyer page shows no stamp until the last day.

  The plan then needed no redesign.
- **Pure helper:** `doorDay.ts` has no `@/` imports, so `node --test` covers all the day math, including midnight, 06:00 and month and year boundaries.
- **Single-day path unchanged:** the `isMultiDay` branch keeps that code path byte-for-byte, so there was no regression risk.
- **Simulated time:** an optional `now` parameter on `checkInTicket` let Level 4 cover 15–18 Jan 2027 without changing any dates in the database.
- **Primary key as the claim:** an `INSERT OR IGNORE` on the primary key inside `db.batch` resolves concurrent scans with no extra locking. This was confirmed on miniflare.

## Challenges Encountered

- **Remote bindings and authentication:**
  - The `env.local` R2 binding is remote. Both `getPlatformProxy` and `astro dev` need Cloudflare credentials.
  - The script path was fixed with `remoteBindings: false`.
  - The dev server was started with `node --env-file=<main checkout>/.env node_modules/astro/astro.js dev`.
- **Admin login in the worktree:** the worktree has no `.dev.vars`, so the admin login has no session secret. The permission system rightly blocked the agent from copying the secrets file. Julio copied it and started the server himself.
- **Phone access over the LAN:** a phone on the LAN cannot open the buyer page, because the site redirects non-localhost requests to https. The fallback was manual code entry in the scanner, or a screenshot of the QR shown to the laptop webcam.

## Bugs Encountered

| Bug | Category | Found By | Severity |
|-----|----------|----------|----------|
| Multi-day tickets checked in before the release would get a second entry the same day (no `ticket_checkins` row) | scope mismatch | code review | medium |
| Admin order detail dates in the browser's time zone | other (time zone) | code review | low |

## Divergences from Plan

**Backfill in the migration**

- **Planned:** "no backfill needed".
- **Actual:** `0014` backfills `ticket_checkins` for multi-day tickets that are already `checked_in`, using `date(checked_in_at, '-11 hours')`.
- **Reason:** finding #1 of the code review. Without the backfill, a ticket checked in before the release would get a second entry and would lose its buyer stamp.
- **Type:** Better approach found

**Bogotá time zone in the admin `formatDate`**

- **Planned:** only the scanner's `formatTime`.
- **Actual:** the admin `formatDate` in `TicketOrdersDashboard.tsx` also gets `timeZone: "America/Bogota"`.
- **Reason:** finding #4 of the code review.
- **Type:** Better approach found

**Level 4 by direct calls instead of HTTP**

- **Planned:** drive `/api/admin/checkin` through the scanner page, shifting the event dates in the local D1.
- **Actual:**
  - The library functions were called directly against the local D1, with simulated times.
  - The HTTP route and the scanner UI were covered by Julio's Level 5 check.
- **Reason:** the agent cannot sign in to the admin, because the worktree has no `.dev.vars`. Simulated times also covered more cases.
- **Type:** Other

**Port**

- **Planned:** 4326.
- **Actual:**
  - The agent's server ended up on 4327.
  - Julio's own server ran on 4326.
- **Type:** Other

## Scope Assessment

- **Planned tasks:** 8 (6 implementation, 2 test)
- **Executed tasks:** 8
- **Unplanned additions:** 2 small ones, both from the code review: the backfill and the admin time zone
- **Scope accuracy:** On target

## Skipped Items

- **Level 1 lint:** there is no lint script, and no prettier check was run.
- **Automated test of the SQL path** (`checkInForDoorDay`): there is no D1 test harness in the repo, and adding one needs a new dependency. Level 4 covered it instead.
- **Events that start between 00:00 and 05:59:** code review finding #3, not changed. The approved domain rule says day 1 is the date of `event_date`, and no such event exists.

## Technical Patterns Discovered

- **Pattern/Gotcha:** library code that uses D1 can be integration-tested without HTTP or an admin login.
  1. Bundle it with esbuild (`--alias:@=./src`).
  2. Call it with `getPlatformProxy({ environment: "local", remoteBindings: false })` from `wrangler`.
  3. Run the script from the project root, so it finds `wrangler.json` and the `.wrangler` state.
- **Where it applies:** checking SQL semantics (`meta.changes`, `db.batch`, races) and testing time-dependent logic with an injected `now`.
- **Ready-to-paste AGENTS.md entry:** `- Integration-test D1 library code without the dev server: bundle the module with npx esbuild --bundle --platform=node --format=esm --alias:@=./src, then from the repo root call it with getPlatformProxy({ environment: "local", remoteBindings: false }) from "wrangler" (remoteBindings: false avoids the Cloudflare login the remote R2 binding needs). Seed with npx wrangler d1 execute DB --local --env local --file <seed.sql>.`

- **Pattern/Gotcha:** `astro dev` in a worktree needs Cloudflare credentials, because R2 in `env.local` is remote. It also needs `.dev.vars` for the admin login, and worktrees have none. Agents must not copy `.dev.vars`, so Julio starts the server himself.
- **Where it applies:** any Level 5 check that uses `/admin` on a local worktree server.
- **Ready-to-paste AGENTS.md entry:** `- Local astro dev from a worktree: start it with node --env-file=/Users/juliochemoreno/Projects/personal/afroin-web/afro-in/.env node_modules/astro/astro.js dev --port <port> (the R2 binding is remote). The admin login also needs .dev.vars, which worktrees lack: Julio copies it himself (cp ../../../.dev.vars .dev.vars); agents never copy or read it.`

- **Pattern/Gotcha:** a phone on the LAN cannot open local pages, because non-localhost requests are redirected to https. The scanner's manual code field exercises the same API as the camera.
- **Where it applies:** door-scanner and QR tests on a local server.
- **Ready-to-paste AGENTS.md entry:** `- Phone testing against local dev does not work over the LAN (non-localhost requests redirect to https). Test the door scanner on the laptop with the manual code field, or show a QR screenshot to the laptop webcam.`

## Recommendations

- **Plan command improvements:**
  - When a feature changes how existing rows are read, as `ticket_checkins` does for tickets already `checked_in`, the plan should ask whether existing data needs a backfill.
  - Check the admin login path for Level 4 when planning.
- **Execute command improvements:** none.
- **AGENTS.md / CLAUDE.md additions:** the three entries above.
- **Production:** Julio runs `0014` before the release that carries D25, and checks it with `PRAGMA table_info(ticket_checkins)`.
