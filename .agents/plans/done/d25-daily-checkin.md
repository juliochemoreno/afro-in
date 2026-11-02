# Plan: D25 — Multi-day events: one check-in per day

## Overview
A multi-day event (`events.end_date` set, D23) sells ONE QR per pass. Today `checkInTicket` marks a ticket `checked_in` once and every later scan answers "already", so a buyer of `pase-afroin-2027-santa-marta` (15–17 Jan 2027) gets in on 15 Jan and is turned away on 16 and 17 Jan. This plan makes that QR valid once per **door day** (Bogotá, rolling over at 06:00) between `event_date` and `end_date`, recorded in a new additive table, while single-day events keep today's behavior exactly. Must be live in production before 15 Jan 2027.

## Requirements Summary
- One QR per pass (no per-day tickets). Valid once per door day from the date of `event_date` to `end_date` inclusive.
- **Door day rolls over at 06:00 Bogotá** (Julio, 2026-11-01): 15 Jan 06:00 → 16 Jan 05:59 is day 1; a scan at 01:30 on 18 Jan is still day 3.
- Scanner answers (multi-day): "Válida · día X de N" + buyer name; "Ya entró hoy" + buyer + "a las HH:MM"; "Fuera de fechas" (before day 1 or after the last day); "Pago no confirmado" / "No encontrada" as today.
- Double entry is impossible on concurrent scans: one atomic `INSERT OR IGNORE` on a `(ticket_id, door_day)` primary key decides.
- Single-day events (`end_date` NULL, or not after the start date): unchanged code path, unchanged answers.
- Admin (Julio: "Detalle por día"): the "Ingresos" columns keep counting tickets that entered **at least once** (first multi-day entry still sets `tickets.status='checked_in'` + `checked_in_at`). In the order detail dialog, each multi-day ticket lists its entries: "Día 1 · 15 ene 9:40 p. m.", "Día 2 · …".
- Buyer page (Julio: "Sin sello hasta el final"): a multi-day ticket shows the "Usada" stamp only after it entered on the **last** day; before that the QR looks unused.
- Door staff workflow unchanged: same admin scanner page, same API route.
- Workflow classification: **sequential user-driven** (one scan → one POST → one verdict). No reactive effects.

## Out of Scope
- A QR per day, per-day tickets or per-day quotas.
- Per-day totals in the Events dashboard ("Día 1: 120 · Día 2: 95") — Julio picked detail-only.
- Undoing a check-in, manual override of a day, re-entry the same day (re-entry answers "Ya entró hoy" by design).
- Date gating for single-day events (today any day works; unchanged).
- Changes to the confirmation email (it is sent at purchase; no "used" state).
- Expected UX iterations: 2 (scanner verdict copy/colors, admin detail line).

## Likely Follow-ups
- Per-day counts in the Events dashboard or a "Hoy: N" counter on the scanner page.
- Admin action to undo a mistaken scan.
- Re-entry policy (leave and come back the same night) if door staff ask for it.

## Git Strategy
- **Base branch:** `dev`
- **Feature branch:** this worktree's branch `claude/d25-daily-checkin-a3d2f0` (already cut from `dev` at `a4d0789`). One PR into `dev`; the orchestrator merges and releases.

## Context References
Verified 2026-11-01 in this worktree:
- `src/lib/tickets.ts:828-892` — `CheckInResult` and `checkInTicket`. Reads `tickets` JOIN `ticket_orders` by code (no join to `events` today, no date check at all), returns `already` if `status='checked_in'`, else `UPDATE tickets SET status='checked_in', checked_in_at=CURRENT_TIMESTAMP WHERE code=? AND status='valid'` and inspects `meta.changes`.
- `src/lib/tickets.ts:761-792` — `TicketOrderView` / `loadTicketOrderView`: loads `events` row (`SELECT *`, so `end_date` is present) and `SELECT code, status, checked_in_at FROM tickets`. Used by `getTicketOrderByToken` (buyer page) and `getTicketOrderByBoldId` (`src/pages/api/tickets/confirm.ts:116`) and `src/lib/ticketEmailSend.ts:83,99` (codes only).
- `src/lib/tickets.ts:896-960` — admin reads: `getEventsForAdmin` (`checked_in` = count of `status='checked_in'`), `getTicketOrdersForAdmin` (`checked_in_count`), `getTicketOrderDetailForAdmin` (`SELECT id, code, status, checked_in_at FROM tickets`). These counts stay as they are.
- `src/pages/api/admin/checkin.ts` — POST `{ code }`, admin only, returns `checkInTicket(...)` JSON with 200. Body validation stays.
- `src/pages/api/admin/tickets/[id].ts` — GET order detail → `getTicketOrderDetailForAdmin`.
- `src/components/CheckinScanner.tsx:5-11` (`Verdict` type), `:79` (count++ on ok), `:246-287` (`verdictCard`), `:289-298` (`formatTime`, uses the device time zone — no `timeZone`).
- `src/components/TicketOrdersDashboard.tsx:45-50` (ticket type), `:669-686` (detail list: "Usada · {formatDate(checked_in_at)}" / "Válida").
- `src/components/TicketList.tsx:81` — `used={tk.status === "checked_in"}` → `TicketQR` stamp (`src/components/TicketQR.tsx:57,99`).
- `src/lib/ticketStages.ts:47-58` — `BOGOTA_UTC_OFFSET_MS` (UTC-5, no DST), `nowBogotaWallClock(now)`, `bogotaToday()`. Reuse the same offset idea; do not import `ticketStages.ts` into the new helper if it pulls `@/` imports (it does not today — it is imported by `tests/ticket-stages.test.ts` directly).
- `migrations/0008_create_ticketing.sql` — `tickets(id INTEGER PK, ticket_order_id, event_id, code UNIQUE, status 'valid'|'checked_in', checked_in_at, created_at)`. `checked_in_at` is SQLite `CURRENT_TIMESTAMP` = UTC `YYYY-MM-DD HH:MM:SS`.
- `migrations/0012_add_event_end_date.sql` — `events.end_date TEXT` (YYYY-MM-DD, Bogotá, inclusive), NULL = one-day. `event_date` is `YYYY-MM-DDTHH:MM` Bogotá wall clock. Last migration is `0013_add_ticket_order_email.sql` → new one is `0014`.
- Tests: `node --experimental-strip-types --test "tests/**/*.test.ts"` (`package.json:58`); pure helpers without `@/` imports are tested directly (pattern: `tests/ticket-stages.test.ts`, `tests/event-display.test.ts`).
- Checks: `npm run check` = `astro build && tsc && wrangler deploy --dry-run`. No lint script exists.
- D23 report (`.agents/execution-reports/d23-event-end-date.md`): local D1 for `astro dev` needs `--env local`; production commands need the absolute `--env-file` path because a worktree has no `.env`; code that reads a new schema object must not deploy before its migration.

Dependents search: `grep -rn "checked_in" src` → 5 files (`TicketList.tsx`, `EventsDashboard.tsx`, `TicketOrdersDashboard.tsx`, `lib/tickets.ts`, `api/admin/checkin.ts`); `grep -rln "api/admin/checkin" src` → 1 (`CheckinScanner.tsx`). Each has a task or is intentionally untouched (`EventsDashboard.tsx` keeps its "at least once" count).

## Domain Assumptions
- A ticket is "multi-day" when its event has `end_date` AND `end_date > event_date[0..10]`. `end_date` equal to the start date is a single-day event.
- Day 1 is the door day of the **date** of `event_date` (from 06:00), not the start hour: on 15 Jan a scan at 15:00 is "día 1" even though the show is at 21:00. Before 15 Jan 06:00 → "Fuera de fechas".
- N = days from the start date to `end_date` inclusive (pase 2027 → 3).
- "Ya entró hoy" blocks a second scan in the same door day (no re-entry).
- `tickets.status='checked_in'` keeps meaning "entered at least once" for multi-day events, so the existing "Ingresos" counts need no change.
- Buyer stamp: "Usada" only when the ticket has an entry on the door day equal to `end_date`.

## Implementation Tasks

### Task 1: Add the per-day check-in table
- **Action:** create
- **File:** `migrations/0014_create_ticket_checkins.sql`
- **Pattern:** `migrations/0012_add_event_end_date.sql` (header comment style)
- **Details:**
  ```sql
  CREATE TABLE IF NOT EXISTS ticket_checkins (
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    door_day TEXT NOT NULL,                 -- YYYY-MM-DD, Bogotá door day (rolls over 06:00)
    checked_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, -- UTC
    PRIMARY KEY (ticket_id, door_day)
  );
  ```
  Header comment: D25, one row per ticket per door day for multi-day events only; additive; single-day events never write here.
- **Gotcha:** Additive only, `IF NOT EXISTS` so `d1 execute --file` can be re-run. Production has no migrations tracking table → Julio applies it with `d1 execute --file` (command in Notes). Code that reads this table must not reach production before it exists (the buyer page of a multi-day order would 500).
- **Validate:** `npx wrangler d1 migrations apply DB --local --env local` then `npx wrangler d1 execute DB --local --env local --command "PRAGMA table_info(ticket_checkins)"` shows 3 columns.

### Task 2: Pure door-day helper
- **Action:** create
- **File:** `src/lib/doorDay.ts`
- **Pattern:** `src/lib/ticketStages.ts:47-74` (pure, no `@/` imports, string wall-clock comparisons)
- **Details:**
  - `export const DOOR_DAY_ROLLOVER_HOUR = 6;`
  - `doorDay(now: number = Date.now()): string` → Bogotá wall clock (UTC-5) minus 6 h, `YYYY-MM-DD`.
  - `isMultiDay(e: { event_date: string; end_date?: string | null }): boolean` → `!!end_date && end_date > event_date.slice(0, 10)`.
  - `doorDayIndex(e, day: string): { day: number; days: number } | null` → null when `day < start` or `day > end_date` or not multi-day; day/days computed with `Date.UTC` on the `YYYY-MM-DD` parts (no local time zone).
  - `bogotaTime(utcTs: string): string` is NOT here (UI formatting stays in components).
- **Gotcha:** Never use `new Date("YYYY-MM-DD")` arithmetic with the local zone; parse parts. Keep it free of `@/` imports so node tests can import it.
- **Validate:** `node --experimental-strip-types --test tests/door-day.test.ts`

### Task 3: Per-day check-in in `checkInTicket`
- **Action:** modify
- **File:** `src/lib/tickets.ts`
- **Pattern:** existing `checkInTicket` (`:838-892`) and the `db.batch` claim in `issueTicketsForOrder` (`:~740-758`)
- **Details:**
  1. Extend `CheckInResult`:
     - `ok`: add optional `day?: number; days?: number`.
     - `already`: add optional `today?: boolean; day?: number; days?: number`.
     - new `{ result: "out_of_range"; attendee: string; eventName: string; startDate: string; endDate: string }`.
  2. Read query adds `t.id AS ticket_id`, and `JOIN events e ON e.id = t.event_id` selecting `e.event_date`, `e.end_date`.
  3. `not_found` / `not_paid` unchanged and checked first.
  4. `if (!isMultiDay(row))` → existing single-day path, byte-for-byte the same behavior.
  5. Multi-day: `const day = doorDay(now)`; `idx = doorDayIndex(row, day)`; null → `out_of_range` (startDate = `event_date.slice(0,10)`, endDate = `end_date`).
  6. `db.batch([INSERT OR IGNORE INTO ticket_checkins (ticket_id, door_day) VALUES (?, ?), UPDATE tickets SET status='checked_in', checked_in_at=CURRENT_TIMESTAMP WHERE id=? AND status='valid'])`. If the INSERT's `meta.changes === 1` → `ok` with `day/days`. Else read `SELECT checked_in_at FROM ticket_checkins WHERE ticket_id=? AND door_day=?` → `already` with `today: true`, `checkedInAt`, `day/days`.
  7. `checkInTicket(db, rawCode, now = Date.now())` — optional `now` for tests/debug only; the API route does not pass it.
- **Gotcha:** The INSERT decides the race, not the prior read. The UPDATE is guarded by `status='valid'`, so day 2+ never moves `checked_in_at` (it stays the first entry). A ticket already `checked_in` before the migration (test scan) still gets its per-day row — no backfill needed.
- **Validate:** `npx tsc --noEmit` clean; Level 4 local scans below.
- **Validation (API):** unchanged — `code` required, string, trimmed to 40, normalized by `normalizeCode`; 400 "Código requerido" / "JSON inválido".
- **Error UX:** scanner verdict cards (Task 4); network failure keeps "Error de red · Reintenta".

### Task 4: Scanner verdicts
- **Action:** modify
- **File:** `src/components/CheckinScanner.tsx`
- **Pattern:** existing `verdictCard` (`:246-287`)
- **Details:**
  - Mirror the new `Verdict` union (ok/already optional fields, `out_of_range`).
  - `ok` with `days`: title = attendee, subtitle = `Válida · día ${day} de ${days}`; without `days`: as today (eventName).
  - `already` with `today`: title "Ya entró hoy", subtitle `${attendee} · a las ${formatTime(checkedInAt)}`; without: "Ya usada" as today.
  - `out_of_range`: red card, title "Fuera de fechas", subtitle `${attendee} · ${startDate} a ${endDate}` formatted short es-CO (e.g. "15 a 17 de ene"); keep it simple.
  - `formatTime`: add `timeZone: "America/Bogota"` so a phone set to another zone still shows door time.
- **Gotcha:** Counter (`:79`) still increments only on `ok`.
- **Validate:** `npx tsc --noEmit`; Level 5.

### Task 5: Admin detail lists entries per day
- **Action:** modify
- **Files:** `src/lib/tickets.ts` (`getTicketOrderDetailForAdmin`), `src/components/TicketOrdersDashboard.tsx`
- **Pattern:** existing detail query (`tickets.ts:~950-960`) and list (`TicketOrdersDashboard.tsx:669-686`)
- **Details:**
  - In `getTicketOrderDetailForAdmin`: load the event (`event_date`, `end_date`) and one query `SELECT c.ticket_id, c.door_day, c.checked_in_at FROM ticket_checkins c JOIN tickets t ON t.id = c.ticket_id WHERE t.ticket_order_id = ? ORDER BY c.door_day` (no per-ticket loop). Attach `checkins: { day: number; days: number; checked_in_at: string }[]` to each ticket (using `doorDayIndex`).
  - Dashboard: when `tk.checkins?.length`, render one line per entry: `Día {day} · {formatDate(checked_in_at)}` (green); else keep today's "Usada · …" / "Válida".
- **Gotcha:** Single-day orders return `checkins: []` → UI identical to today.
- **Validate:** `npx tsc --noEmit`; Level 5 (open an order in admin after scans).

### Task 6: Buyer stamp only after the last day
- **Action:** modify
- **File:** `src/lib/tickets.ts` (`loadTicketOrderView`)
- **Pattern:** existing `loadTicketOrderView` (`:767-792`)
- **Details:** After loading `event`, if `isMultiDay(event)`: select `status` as `CASE WHEN EXISTS (SELECT 1 FROM ticket_checkins c WHERE c.ticket_id = tickets.id AND c.door_day = ?) THEN 'checked_in' ELSE 'valid' END` bound to `event.end_date`; otherwise the current query. `TicketList.tsx` stays untouched.
- **Gotcha:** This also changes what `/api/tickets/confirm` returns for multi-day orders (same view) — intended. `ticketEmailSend` only reads codes.
- **Validate:** `npx tsc --noEmit`; Level 5 (buyer page after a day-1 scan shows no stamp).

## Test Tasks

### Task 7: Door-day unit tests
- **Action:** create
- **File:** `tests/door-day.test.ts`
- **Pattern:** `tests/ticket-stages.test.ts`
- **Details:** Using `Date.UTC(...)` instants (Bogotá = UTC-5):
  - `doorDay`: 15 Jan 05:59 Bogotá → `2027-01-14`; 06:00 → `2027-01-15`; 16 Jan 01:30 → `2027-01-15`; 18 Jan 05:59 → `2027-01-17`; 18 Jan 06:00 → `2027-01-18`.
  - `isMultiDay`: null end → false; end == start date → false; pase 2027 → true.
  - `doorDayIndex` for the pase (`2027-01-15T21:00` / `2027-01-17`): 14 → null; 15 → {1,3}; 16 → {2,3}; 17 → {3,3}; 18 → null; single-day event → null.
  - Month/year boundary: `2026-12-31T22:00` → `2027-01-02` gives days 3 and `2027-01-01` = day 2.
- **Validate:** `npm test` (all files green).

### Task 8: Regression of the single-day path
- **Action:** N/A (manual, Level 4)
- **File:** N/A
- **Pattern:** N/A
- **Details:** On local D1, a single-day event ticket: first scan → green with event name; second scan → "Ya usada · hora". Buyer page shows "Usada" after the scan. Admin detail shows "Usada · …".
- **Gotcha:** N/A
- **Validate:** local scans via the scanner page (manual entry field).

## Validation Checklist
- [x] **Level 1 — Lint & Format:** WAIVED: the repo has no lint script and no prettier check was run (see the report).
- [x] **Level 2 — Type Check:** ✓ `npm run check` passed; `tsc --noEmit` clean again after syncing with origin/dev.
- [x] **Level 2.5 — Code Review:** ✓ fresh-context review in `.agents/code-reviews/d25-daily-checkin.md` (0 critical/high, 2 fixed); copy in the shared notes folder.
- [x] **Level 3 — Unit Tests:** ✓ `npm test` 104/104 (7 new).
- [x] **Level 4 — Integration (local, agent):** ✓ by direct calls on the local D1 with simulated times instead of the HTTP route (no admin login in the worktree): every listed case, including the single-day regression, passed; HTTP and scanner UI covered by Level 5.
- [x] **Level 5 — Human Review** ✓ Julio, 2026-11-01, local server on 4326: "ya hice la prueba todo ok".

## Acceptance Criteria
- [x] (✓ Level 4, simulated 14–18 Jan 2027) Pase 2027 ticket: one entry per door day 15, 16, 17 Jan; a second scan the same door day answers "Ya entró hoy" with the first time; scans on 14 Jan or after 18 Jan 06:00 answer "Fuera de fechas"; 01:30 on 16 Jan counts as day 1.
- [x] (✓ Level 4: Promise.all double scan → ok + already, one row) Two concurrent scans of the same code on the same door day produce exactly one `ticket_checkins` row and one "Válida".
- [x] (✓ Level 4 + Julio) Single-day events behave exactly as before.
- [x] (✓ Level 4 admin detail + Julio) Admin "Ingresos" counts unchanged in meaning; order detail lists days for multi-day tickets.
- [x] (✓ Level 4: stamp only after day 3) Buyer page shows "Usada" for a multi-day ticket only after the last-day entry.
- [x] `npm run check` and `npm test` green. ✓

## Confidence Score: 8/10
- **Strengths:** small surface (one function, one table, two views); atomic PK insert pattern; D23 already put `end_date` everywhere `SELECT e.*` is used.
- **Uncertainties:** D1 `batch` `meta.changes` per statement for `INSERT OR IGNORE` (expected 0/1 — confirm in Level 4); scanner phone-camera testing locally.
- **Mitigations:** Level 4 checks the double-scan path on real local D1; fallback for the human check is the laptop webcam.

## Notes for Executing Agent
- **Production migration (Julio runs it, before the release that carries this code):**
  ```bash
  node --env-file=/Users/juliochemoreno/Projects/personal/afroin-web/afro-in/.env node_modules/wrangler/bin/wrangler.js d1 execute afroin --remote --file migrations/0014_create_ticket_checkins.sql
  ```
  Run from the main checkout (or this worktree — the path to `.env` is absolute). Verify: `... d1 execute afroin --remote --command "SELECT name FROM sqlite_master WHERE name='ticket_checkins'"`. The staging/preview D1 (`afroin-preview`) gets it with `npx wrangler d1 migrations apply PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc` if a Preview is used.
- Never read `.env`; Cloudflare credentials only via `--env-file`. Public repo: no secrets in commits.
- Local dev: `--env local` for every local D1 command (D23 gotcha). Use port 4326; add a `.claude/launch.json` entry for it only in this worktree if needed.
- Do not change `EventsDashboard.tsx`, the email, or `TicketList.tsx`.
- UI copy is `[provisional]`; Julio will tune wording at Level 5. **Expected UX iterations: 2**

## Outcome
Merged into `dev` via [PR #28](https://github.com/juliochemoreno/afro-in/pull/28) (1541fe3, merge adfa97d). Report: `.agents/execution-reports/d25-daily-checkin.md`. Migration 0014 pending in production (Julio, before the release).
