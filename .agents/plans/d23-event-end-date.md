# Plan: D23 — Multi-day events: an end date

## Overview
An event has one `event_date` today, so the production festival pass `pase-afroin-2027-santa-marta` (Santa Marta, 15–17 Jan 2027) shows only 15 Jan, and the site hides it and stops selling it at 15 Jan 21:00. This plan adds an optional last day (`events.end_date`), uses it for visibility and sales, shows the range on every public surface, and lets the admin set it.

## Requirements Summary
- Optional `events.end_date` (`YYYY-MM-DD`, Bogotá, inclusive last day). Additive migration `0012`. NULL = one-day event, behavior unchanged.
- **Sales and visibility (Julio, 2026-11-01): until the end of the last day, Bogotá time.** With `end_date`, an event is visible and on sale until `end_date` 23:59:59 Bogotá. Without it, until `event_date` (today's rule).
- **No door price (Julio, 2026-11-01).** The current stage keeps selling during the festival days. The last stage of the pass (45.000, no `ends_on`) already runs "until the event"; nothing to change in the production stages.
- Admin event form: optional "Último día" date field. Admin is Spanish-only (no i18n keys).
- Display (Julio chose "días con guion", 2026-11-01):
  - Events list card, gold block: `vie–dom` / `15–17` / `ene` (across months: `mié–vie` / `30–1` / `dic–ene`). Number a bit smaller so it fits.
  - Event page kicker over the title: `Vie 15 – Dom 17 Ene 2027` (today `Dom 20 Dic 2026` for one day). Start time stays as is.
  - Ticket stubs (TicketQR gold block) same as the card; receipt / tickets subtitle: `15–17 ene 2027` (en `Jan 15–17, 2027`, fr `15–17 janv 2027`).
  - Admin events grid: date cell shows the range; "Pasado" after the last day.
- Header pass season (`PASS_SEASON_END`) moves from 2027-01-15 to 2027-01-17, so the header logic matches the page.
- `/api/tickets/stages` follows automatically (it calls `getEventBySlug`).
- Workflow classification: **sequential user-driven** (admin saves a form; buyers check out). No reactive effects.

## Out of Scope
- Door prices / stages inside the festival days (Julio: no door price). Validation still allows a stage to end on the last day (see Domain Assumptions), but nothing is created.
- Per-day tickets or a per-day program on the event page.
- Changing production data from code. Julio sets `end_date = 2027-01-17` on the pass in the production admin after the release (step in Notes).
- JSON-LD in `src/layouts/Layout.astro` (hardcoded 2026 events, unrelated).
- An end **time**. The last day ends at 23:59:59 Bogotá.

Expected UX iterations: 2

## Likely Follow-ups
- Door price stage for the festival days if Julio changes his mind (validation already allows it).
- Show the range on the 2027 home tickets block (`EditionTickets.astro`, it uses content-collection dates, already a range).
- Per-day check-in stats in the admin.

## Git Strategy
- **Base branch:** `dev`
- **Feature branch:** `feature/d23-event-end-date` (this worktree's branch `claude/d23-event-end-date-6501c3` can be renamed or used; one PR to `dev`).
- **PR #23 overlap:** `feat/programacion-tickets-redesign` (not merged) rewrites `src/templates/EventoSlugTemplate.astro`, `src/templates/EventosIndexTemplate.astro`, `src/components/TicketCheckoutForm.tsx` and touches `src/lib/mainMenu.ts`. Phase 1 below touches none of them. **Before Phase 2:** `git fetch && git merge origin/dev` once the orchestrator confirms #23 landed (ask if unsure). Do not edit those four files before that.

## Context References
Verified 2026-11-01 on `dev` = `204ab4b` (`git log --oneline -1 origin/dev` → `204ab4b`).

- `migrations/0008_create_ticketing.sql:10-27` — `events` table: `event_date TEXT NOT NULL -- ISO 8601, e.g. 2026-01-17T20:00`. No end column. `migrations/0009_*` shows the additive `ALTER TABLE events ADD COLUMN` pattern. Last migration is `0011_create_event_price_stages.sql` → new one is `0012`.
- `src/lib/tickets.ts:64` — `EventRow.event_date`. Add `end_date?: string | null`.
- `src/lib/tickets.ts:100-104` — comment "An event is on sale until it starts." (update).
- `src/lib/tickets.ts:250-266` — `getVisibleEvents`: `WHERE e.visible = 1 AND e.event_date > ?` bound to `nowBogotaWallClock()`; `ORDER BY e.event_date ASC` (keep the order).
- `src/lib/tickets.ts:269-287` — `getEventBySlug`: `if (!row.visible || row.event_date <= nowBogotaWallClock()) return null;` (`SELECT e.*`, so `end_date` arrives without query changes).
- `src/lib/tickets.ts:336-354` — checkout: `SELECT id, slug, name_es, price, capacity, visible, event_date FROM events WHERE slug = ?` then `if (!event.visible || event.event_date <= nowBogotaWallClock()) throw new CheckoutError("El evento no está disponible")`. Must add `end_date` to the SELECT list.
- `src/lib/tickets.ts:356-371` — stage resolution uses `bogotaToday()` and `resolveSale`; **does not read `event_date`**. `src/lib/ticketStages.ts:66-95` `stageStatuses`: a stage with `ends_on = NULL` is never "ended by date" → the pass's last stage (45.000, open-ended) keeps selling through 17 Jan with no change. Verified by reading; covered by the existing test "the last stage without an end date runs until the event" (`tests/ticket-stages.test.ts:88`).
- `src/lib/tickets.ts:752-756` — `loadTicketOrderView` uses `SELECT * FROM events` → tickets page / receipt API (`src/pages/api/tickets/confirm.ts:104` returns `view.event`) get `end_date` automatically.
- `src/lib/tickets.ts:878-892` — `getEventsForAdmin` uses `SELECT e.*` → admin grid gets `end_date`.
- `src/pages/api/tickets/stages.ts:35` — calls `getEventBySlug(db, slug)`; 404 when over. Follows the new rule with no edit. Cache 60 s (unchanged).
- `src/lib/ticketStages.ts:50-58` — `nowBogotaWallClock()` returns `YYYY-MM-DDTHH:MM:SS`; `bogotaToday()`.
- `src/lib/ticketStages.ts:152-215` — `validateStages(input, { eventDate, minAmount })`: refuses a stage that starts or ends after `eventDay = eventDate.slice(0,10)`. Callers: `src/lib/eventAdmin.ts:66-69` (`parseStages`) and `src/components/admin/EventForm.tsx:514-517` (client check).
- `src/lib/eventAdmin.ts:7-24` — `EVENT_COLUMNS` (used by `src/pages/api/admin/events/index.ts:46-54` INSERT and `src/pages/api/admin/events/[id].ts:74-82` UPDATE); `eventValues` at `:136-155` must stay in the same order. `validateEventInput` at `:32-52`. `eventAdmin.ts` imports `@/lib/orders`, so node tests cannot load it → pure validation goes in `ticketStages.ts`.
- `src/components/admin/EventForm.tsx:132,152,175,233` — `event_date` in `EventRow`, `FormState`, `EMPTY`, `toForm`. Date/time card at `:935-989` ("Fecha y Hora": "Fecha del evento" + "Hora de inicio").
- `src/components/EventsDashboard.tsx:89-100` — `DateCell`: `past = new Date(d.event_date) < new Date()`, shows "Pasado".
- `src/lib/eventDisplay.ts` — `wallClock`, `tidy`, `calParts(eventDate, lang)`, `eventTime`, `shortDate(eventDate, lang)`. Pure, loaded by `tests/event-display.test.ts`.
- Display callers (`grep -rln "calParts\|shortDate\|eventTime" src`, 8 hits; the eventDisplay ones): `src/components/TicketQR.tsx:74` (calParts for the stub block, prop `eventDate`), `src/components/TicketList.tsx:17,30,76` (passes `eventDate` to TicketQR), `src/components/TicketReceipt.tsx:23` (shortDate subtitle) and `:126` (eventDate to TicketList), `src/templates/EntradasTemplate.astro:71` (shortDate) and `:110` (eventDate), `src/templates/EventosIndexTemplate.astro` (calParts), `src/templates/EventoSlugTemplate.astro` (calParts + eventTime). `programacion.ts` / `Edition2027IndexTemplate.astro` use their own helpers, not affected.
- PR #23 versions (`git show origin/feat/programacion-tickets-redesign:<file>`): EventoSlugTemplate builds `dateShort = [cap(cal.weekday), cal.day, cap(cal.month), year].join(" ")` (line 35) and renders `<p class="fz-display evento-kicker">{dateShort}</p>` (line 148). EventosIndexTemplate maps `cal: calParts(e.event_date, lang)` (line 53) and renders `.fz-cal.ev-cal` with `fz-cal-wd` / `fz-cal-num` / `fz-cal-wd` plus an sr-only full date (lines 145-154); `.ev-cal { --fz-cal-num: 26px }` (line 329-335).
- `src/lib/mainMenu.ts:9-20` — `PASS_SEASON_END = "2027-01-15"`, `isPassSeason`; used by `src/components/Header.astro:550-571`. Test `tests/main-menu.test.ts:5-9` asserts 2027-01-15 23:59 true / 2027-01-16 00:00 false. PR #23 adds two flags right above these lines (merge after #23).
- Dependents search for the changed "past event" rule: `grep -rn "event_date" src | grep -v content` → `tickets.ts` (258, 285, 353 = the three gates; 64, 338, 349 types/select; 891 order), `eventAdmin.ts`, `EventForm.tsx`, `EventsDashboard.tsx:91` (the fourth "past" rule), display files above. All have a task.
- **Platform spike — Intl output.** `node -e` with `Intl.DateTimeFormat(...).formatRange` on Node 22.14: es-CO gives `"15 a 17 de ene de 2027"`, en-US `"Jan 15 – 17, 2027"`, fr-FR `"15–17 janv. 2027"`. es does not match the wanted `15–17 ene 2027`, and ICU data may differ in Workers → **build ranges from parts** (`wallClock` + `tidy`), never `formatRange`. Weekday short: es `vie|dom`, en `Fri|Sun`, fr `ven.|dim.` (tidy drops the dot).
- Existing `shortDate` es output in Node is `"15 de ene de 2027"` (es-CO inserts "de"). The new range format for es is `15–17 ene 2027` as Julio wrote it; single-day `shortDate` stays unchanged (not in scope).
- Migrations (`.agents/orchestrator.md`, "Release and deploy"): staging `npx wrangler d1 migrations apply PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc` (pre-approved). **Production has no tracking table: never `migrations apply` against `wrangler.json`.** Production = `d1 execute --file`, Julio's OK, applied BEFORE the release that needs it. From a worktree wrangler rejects `--env-file` on d1 → `node --env-file=<main>/.env node_modules/wrangler/bin/wrangler.js d1 …` (`.agents/execution-reports/d13-staged-ticket-prices.md:65`).
- `wrangler.json:20-25` — top-level D1 binding `DB` = database `afroin` (production).

## Domain Assumptions
- `end_date` is the **last day** of the event, inclusive, a Bogotá calendar date with no time. The event is over at `end_date` 23:59:59 Bogotá — confirm.
- `end_date` must be **after** the start day (same day is refused with a message; leave it empty for one-day events) — confirm.
- With `end_date`, the start time (`event_date` time) is still shown as is (e.g. "9:00 p. m.") on the card and page; it is the first day's start time — confirm.
- A price stage may end on (or start before) the last day instead of the start day; an open-ended last stage runs until the last day. No door stage is created — confirm.
- Free events and single-price (no stages) multi-day events follow the same rule: on sale until the last day — confirm.
- The header pass season ends 2027-01-17 instead of 2027-01-15 (the header CTA is off in PR #23, but the rule stays consistent) — confirm.
- Order list stays sorted by start date (`event_date`) — confirm.

## Requirements Delta

### ADDED Requirements
- REQ-TIX-030: Multi-day events
  - Scenario: Visible on a middle day — Given an event 2027-01-15T21:00 with end_date 2027-01-17, When a buyer opens the events list on 2027-01-16 (Bogotá), Then the event is listed and its page loads.
  - Scenario: On sale on the last day — Given the same event, When a buyer checks out on 2027-01-17 at 23:00 Bogotá, Then the order is created at the current stage price.
  - Scenario: Over after the last day — Given the same event, When it is 2027-01-18 00:00 Bogotá, Then the list hides it, its page 404s and the checkout refuses with "El evento no está disponible".
  - Scenario: One-day event unchanged — Given an event with no end_date, Then it is visible and on sale until its event_date (today's rule).
  - Scenario: Range shown — Given end_date, Then the card shows `vie–dom / 15–17 / ene`, the page kicker `Vie 15 – Dom 17 Ene 2027`, the ticket subtitle `15–17 ene 2027`.

## Implementation Tasks

### Phase 1 — data, rules, admin, tickets (no PR #23 files)

### Task 1: Add migration 0012
- **Action:** create
- **File:** `migrations/0012_add_event_end_date.sql`
- **Pattern:** `migrations/0009_add_event_location_fields.sql`
- **Details:** Header comment (what, why, additive, NULL = one-day event, `YYYY-MM-DD` Bogotá inclusive). One statement: `ALTER TABLE events ADD COLUMN end_date TEXT;`. No index (visibility queries already scan `visible = 1` rows, a handful).
- **Gotcha:** Must be applied to production BEFORE the release: the new SQL in `getVisibleEvents` references `e.end_date` and would fail on the old schema (the events list would 500). No `IF NOT EXISTS` for ADD COLUMN in SQLite → run once only.
- **Validate:** `node --env-file=/Users/juliochemoreno/Projects/personal/afroin-web/afro-in/.env node_modules/wrangler/bin/wrangler.js d1 migrations apply PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc`, then `… d1 execute PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc --command "SELECT name FROM pragma_table_info('events') WHERE name='end_date'"` → one row.

### Task 2: Pure end-of-event rule and end-date validation
- **Action:** modify
- **File:** `src/lib/ticketStages.ts`
- **Pattern:** existing `nowBogotaWallClock` / `isDate` / `validateStages` in the same file
- **Details:**
  1. `export function eventEndsAt(e: { event_date: string; end_date?: string | null }): string` → `e.end_date ? \`${e.end_date}T23:59:59\` : e.event_date`. Comment: wall-clock string compared with `nowBogotaWallClock()`; the event is over when `eventEndsAt(e) <= now`.
  2. `export function isEventOver(e, now = nowBogotaWallClock()): boolean` → `eventEndsAt(e) <= now`.
  3. `export function validateEndDate(eventDate: string, endDate: unknown): { endDate: string | null } | { error: string }`: empty/null → `{ endDate: null }`; not `isDate` → `"El último día debe ser AAAA-MM-DD"`; `<= eventDate.slice(0,10)` → `"El último día debe ser después de la fecha de inicio"`. (No max length cap.)
  4. `validateStages` opts gain `endDate?: string | null`; `lastDay = endDate || eventDay`; the two checks become `starts_on > lastDay` → "empieza después del evento", `ends_on > lastDay` → "termina después del evento".
  5. Update the header comment: "a stage without ends_on runs until the event's last day".
- **Gotcha:** `nowBogotaWallClock()` has seconds; `T23:59:59` makes 23:59:59 the first "over" second (1 s early) — acceptable, document it. Keep the file free of `@/` imports (tests load it directly).
- **Validate:** `node --experimental-strip-types --test tests/ticket-stages.test.ts`

### Task 3: Use the end date in the public reads and the checkout guard
- **Action:** modify
- **File:** `src/lib/tickets.ts`
- **Pattern:** the existing gates at lines 258, 285, 353
- **Details:**
  1. `EventRow`: add `end_date?: string | null;`.
  2. Replace the comment at 100-104: an event is on sale until it is over (`eventEndsAt`: last day 23:59:59 when `end_date` is set, else its start).
  3. `getVisibleEvents`: `WHERE e.visible = 1 AND COALESCE(e.end_date || 'T23:59:59', e.event_date) > ?` (SQLite: `NULL || 'x'` is NULL, so COALESCE falls back). Keep `ORDER BY e.event_date ASC`. Add a one-line comment that it mirrors `eventEndsAt` in `ticketStages.ts`.
  4. `getEventBySlug`: `if (!row.visible || isEventOver(row)) return null;`.
  5. Checkout: add `end_date` to the SELECT column list and the `.first<…>()` type; guard becomes `if (!event.visible || isEventOver(event))`.
  6. Import `isEventOver` from `./ticketStages` (same import block as `nowBogotaWallClock`; drop `nowBogotaWallClock` import only if no longer used — it is still used by `getVisibleEvents`' bind).
- **Gotcha:** The SQL and the TS rule must stay identical; a unit test covers `eventEndsAt`, and Task 11 covers the SQL on staging. Do not touch `confirm.ts`/`issueTicketsForOrder`: a payment approved after the cutoff for an order created before it must still issue tickets (today's behavior).
- **Validate:** `npx tsc --noEmit -p .` (or `npm run check` at the phase end); `grep -n "event_date <= \|event_date > ?" src/lib/tickets.ts` → no hits.
- **Validation (API):** checkout input unchanged. **Error UX:** after the last day, the buy form shows the existing "El evento no está disponible" message; the page itself 404s on reload.

### Task 4: Admin save path for end_date
- **Action:** modify
- **File:** `src/lib/eventAdmin.ts`
- **Pattern:** existing `EVENT_COLUMNS` / `eventValues` / `validateEventInput`
- **Details:**
  1. Add `"end_date"` to `EVENT_COLUMNS` right after `"event_date"`, and `str(body.end_date, 10)` at the same position in `eventValues` (empty → null).
  2. In `validateEventInput`, after the `event_date` format check: `const end = validateEndDate(date, body.end_date); if ("error" in end) return end.error;`.
  3. `parseStages`: pass `endDate: str(body.end_date, 10)` to `validateStages`.
- **Gotcha:** `EVENT_COLUMNS` and `eventValues` must keep the same order (the INSERT and UPDATE bind positionally). An old admin client that sends no `end_date` would clear it on save — fine, the form always sends the field.
- **Validate:** `npx tsc --noEmit -p .`; curl on Level 4.
- **Validation (API):** `end_date` optional, `YYYY-MM-DD`, after the start day. **Error UX:** the admin form shows the returned Spanish message in its error banner (existing `setError` path).

### Task 5: "Último día" field in the admin event form
- **Action:** modify
- **File:** `src/components/admin/EventForm.tsx`
- **Pattern:** the "Fecha del evento" `<Input type="date">` at lines 944-954
- **Details:**
  1. `end_date?: string | null` in `EventRow`; `end_date: string` in `FormState`; `""` in `EMPTY`; `e.end_date || ""` in `toForm`.
  2. In the "Fecha y Hora" card, under "Fecha del evento": `<Label htmlFor="e-end-date">Último día (si dura varios días)</Label>` + `<Input id="e-end-date" type="date" min={next day of datePart} value={form.end_date} onChange={…set("end_date", v)} />` and a small "Quitar" text button when filled. Helper text, muted, one line: "Vacío = evento de un día."
  3. `save()`: before stages, `validateEndDate(form.event_date, form.end_date)` → `setError(...)`; pass `endDate: form.end_date || null` to the client `validateStages` call. The payload already spreads `fields`, so `end_date` is sent; send `null` when empty.
- **Gotcha:** The dirty-check snapshot (`snapshot` ref) compares `JSON.stringify(initial)` → include `end_date` in `toForm` so an untouched form is not dirty. Changing the start date to after the end date must be caught on save (validation), not silently cleared.
- **Validate:** `npx tsc --noEmit -p .`; manual: admin form loads, saves with and without the field (Level 5).

### Task 6: Admin events grid shows the range and the right "Pasado"
- **Action:** modify
- **File:** `src/components/EventsDashboard.tsx`
- **Pattern:** `DateCell` at lines 89-100
- **Details:** `end_date?: string | null` in the row type. `past = isEventOver(d, nowBogotaWallClock())` (import from `@/lib/ticketStages`; fixes the current local-time `new Date()` parse too). Show `formatDate(d.event_date)` and, with `end_date`, ` – ${formatDate(end_date)}` (reuse the file's `formatDate`; for a date-only string pass `${end_date}T12:00` so it never shifts a day).
- **Gotcha:** `formatDate` may include the time; for the end show only the day. Read `formatDate` before deciding.
- **Validate:** `npx tsc --noEmit -p .`

### Task 7: Range display helpers
- **Action:** modify
- **File:** `src/lib/eventDisplay.ts`
- **Pattern:** `calParts` / `shortDate` / `wallClock` / `tidy` in the same file
- **Details:**
  1. `calParts(eventDate, lang, endDate?: string | null)`: with an `endDate` after the start day, return `weekday: "vie–dom"`, `day: "15–17"`, `month: "ene"` (same month) or `"dic–ene"` (different months). Use an en dash `–` with no spaces. Without `endDate`, output unchanged.
  2. `export function kickerDate(eventDate, lang, endDate?)`: the page kicker. One day: `Dom 20 Dic 2026` (moves PR #23's inline `dateShort` here: capitalized weekday and month, then year). Range same year: `Vie 15 – Dom 17 Ene 2027` (same month) / `Mié 30 Dic – Vie 1 Ene 2027` (different months); different years: `Mié 30 Dic 2026 – Vie 1 Ene 2027`. Spaced en dash ` – ` here (two full dates).
  3. `export function shortDateRange(eventDate, lang, endDate?)`: no endDate → `shortDate(eventDate, lang)` (unchanged). Same month: es/fr `15–17 ene 2027` / `15–17 janv 2027`, en `Jan 15–17, 2027`. Different months same year: es/fr `30 dic – 2 ene 2027`, en `Dec 30 – Jan 2, 2027`. Different years: both full `shortDate`s joined with ` – `.
  4. Parse `endDate` with `wallClock` (accepts `YYYY-MM-DD`). An `endDate` that is empty, invalid or not after the start day → treat as no range.
- **Gotcha:** Build from parts (`toLocaleDateString` per part with `timeZone: "UTC"` + `tidy`), never `Intl.formatRange` (spike: es-CO gives "15 a 17 de ene de 2027"; ICU may differ in Workers). Keep no `@/` imports.
- **Validate:** `node --experimental-strip-types --test tests/event-display.test.ts`

### Task 8: Ticket stubs and receipts show the range
- **Action:** modify
- **Files:** `src/components/TicketQR.tsx`, `src/components/TicketList.tsx`, `src/components/TicketReceipt.tsx`, `src/templates/EntradasTemplate.astro`
- **Pattern:** the existing `eventDate` prop threading
- **Details:** Add an optional `eventEndDate?: string | null` prop to `TicketList` and `TicketQR` (next to `eventDate`, same doc comment style); TicketQR calls `calParts(eventDate, lang, eventEndDate)`. TicketReceipt: `eventSubtitle` uses `shortDateRange(event.event_date, lang, event.end_date)`; pass `eventEndDate={event?.end_date ?? null}`. EntradasTemplate: `buildSubtitle` uses `shortDateRange(ev.event_date, lang, ev.end_date)`; pass `eventEndDate={tokenOrder.event?.end_date ?? null}`.
- **Gotcha:** The stub gold block (`.tix-stub-cal-num`) may need a smaller font for `15–17`; check `src/styles/tickets-theme.css` (or wherever `.tix-stub-cal` lives) and add a modifier class only when the day contains `–`. Print view must keep fitting (see D18 print gotcha).
- **Validate:** `npx tsc --noEmit -p .`; Level 5 visual check of `/entradas/<token>` on the Preview.

### Task 9: Tests for the date logic (Phase 1)
- **Action:** modify
- **Files:** `tests/ticket-stages.test.ts`, `tests/event-display.test.ts`
- **Pattern:** existing `test(...)` cases in each file
- **Details:**
  - ticket-stages: `eventEndsAt` with and without `end_date`; `isEventOver` at 2027-01-15T21:00:00 (one-day event over; multi-day not), 2027-01-17T23:59:58 (not over), 2027-01-17T23:59:59 and 2027-01-18T00:00:00 (over); `validateEndDate`: empty → null, bad format, same day refused, earlier refused, next day ok; `validateStages` with `endDate`: stage ending on the last day accepted, after it refused; without `endDate` the old rule still holds.
  - event-display: `calParts` with range same month (es/en/fr) and across months; `kickerDate` one day (`Dom 20 Dic 2026` for `2026-12-20T20:00`), range same month, across months, across years; `shortDateRange` es/en/fr same month, across months, across years, no endDate equals `shortDate`, invalid/earlier endDate ignored.
- **Gotcha:** Write the test cases before or with Tasks 2 and 7; they land in the same commit as the code (never commit RED).
- **Validate:** `npm test`

### Phase 2 — after PR #23 lands (`git fetch && git merge origin/dev` first)

### Task 10: Event page kicker and events list cards
- **Action:** modify
- **Files:** `src/templates/EventoSlugTemplate.astro`, `src/templates/EventosIndexTemplate.astro`
- **Pattern:** PR #23's versions (kicker line 35/148; card `.ev-cal` lines 53, 145-154, 329-335)
- **Details:**
  - Slug: replace the inline `cap`/`dateShort` with `const dateShort = kickerDate(event.event_date, lang, event.end_date);` (remove `cal` if no longer used).
  - Index: `cal: calParts(e.event_date, lang, e.end_date)`; the sr-only text becomes the full `shortDateRange(...)`; add `is-range` class to `.ev-cal` when `e.end_date` and give `.ev-cal.is-range` a smaller `--fz-cal-num` (start ~20px; Julio tunes on the Preview).
- **Gotcha:** Re-read both files after the merge; line numbers above are PR #23's and may have moved. Copy rules: no repeated info in a block (do not add a second date line), "Comprar entradas"/"entradas" wording untouched.
- **Validate:** `npm run check`; Level 5 visual.

### Task 11: Header pass season ends on the last festival day
- **Action:** modify
- **Files:** `src/lib/mainMenu.ts`, `tests/main-menu.test.ts`
- **Pattern:** existing constants and test
- **Details:** `PASS_SEASON_END = "2027-01-17"`; comment "until the pass event's last day (2027-01-17)". Test: rename to "covers 2026-11-01 to 2027-01-17", 2027-01-17T23:59-05:00 true, 2027-01-18T00:00-05:00 false.
- **Gotcha:** PR #23 edits the lines right above; do it after the merge to avoid a conflict.
- **Validate:** `node --experimental-strip-types --test tests/main-menu.test.ts`

## Test Tasks
- Task 9 (unit, Phase 1) and the test part of Task 11 (Phase 2).
- **Regression check:** one-day events keep today's behavior (unit tests for `isEventOver` without `end_date`; Level 4 curl of an existing one-day staging event). Admin create/edit of an event without the new field still saves.

## Phase Boundaries
- **Commit A (Phase 1):** Tasks 1–9. Tests in it: `tests/ticket-stages.test.ts`, `tests/event-display.test.ts` (both GREEN). Code review (Level 2.5) on this commit.
- **Merge `origin/dev`** (PR #23) — only after the orchestrator confirms it landed.
- **Commit B (Phase 2):** Tasks 10–11. Tests in it: `tests/main-menu.test.ts` (GREEN).
- Then one fresh-context review of the whole branch (strongest model), then PR to `dev`.

## Validation Checklist
- [ ] **Level 1 — Lint & Format:** no linter in this repo (`.agents/orchestrator.md`); skip.
- [ ] **Level 2 — Type Check / build:** `npm run check` (astro build + tsc + wrangler dry-run)
- [ ] **Level 2.5 — Code Review:** `code-review` skill on the Phase 1 commit, then one fresh-context review of the branch (strongest model), saved to `.agents/code-reviews/d23-event-end-date.md`
- [ ] **Level 3 — Unit Tests:** `npm test`
- [ ] **Level 4 — Integration (staging D1, via the branch Preview or `astro dev` with remote bindings):**
  - Apply 0012 to staging (Task 1 command). In staging only, create or edit a test event with start = today − 1 day 20:00 and `end_date` = today + 1 (admin form on the Preview). Check: `/eventos` lists it; `/eventos/<slug>` 200 in es/en/fr; `POST /api/tickets/checkout` creates a pending order (do not pay; or use a free test event).
  - Set its `end_date` to yesterday (admin) → list hides it, page 404, checkout returns "El evento no está disponible".
  - An existing one-day staging event behaves as before.
  - Admin: save with an `end_date` on the start day → error "El último día debe ser después de la fecha de inicio".
- [ ] **Level 5 — Human Review (Julio, on the branch Preview, before merge):**
  - Events list card for a multi-day event: gold block `vie–dom / 15–17 / ene` fits and reads well (light and dark theme). If skipped: the card layout ships unseen.
  - Event page kicker `Vie 15 – Dom 17 Ene 2027` over the title, in es/en/fr. If skipped: copy/format ships unseen.
  - Tickets page / stub for an order of the multi-day event: range in the block and the subtitle, print view. If skipped: the stub may overflow on phones or print.
  - Admin form: "Último día" field wording and placement. If skipped: admin wording ships unseen.

## Acceptance Criteria
- [ ] With `end_date = 2027-01-17`, the pass is listed, its page loads and the checkout charges the current stage on 16 and 17 Jan (Bogotá), and none of that happens from 18 Jan 00:00.
- [ ] Events without `end_date` behave exactly as before (unit tests + staging check).
- [ ] The admin can set, change and clear the last day; invalid values are refused with a Spanish message, on the client and on the server.
- [ ] Card, page kicker, ticket stub and receipt subtitle show the range in es/en/fr as specified.
- [ ] `npm run check` and `npm test` pass; review artifact saved.
- [ ] Production migration command handed to Julio; no production data or `main` touched.

## Confidence Score: 8/10
- **Strengths:** The three gates are explicit and few; stage logic does not read `event_date`, so prices need no change; `SELECT *` carries the column to the ticket pages and the admin grid; display helpers are pure and tested.
- **Uncertainties:** PR #23 timing and its final template code; how `15–17` fits the gold blocks visually; the SQL/TS twin of the cutoff rule.
- **Mitigations:** Phase split around the #23 merge; `is-range` modifier tuned on the Preview; unit tests for `eventEndsAt` plus a staging check of the SQL path.

## Notes for Executing Agent
- Never read `.env`. Cloudflare creds only via `node --env-file=/Users/juliochemoreno/Projects/personal/afroin-web/afro-in/.env node_modules/wrangler/bin/wrangler.js …` (zsh: wrap in a function). Public repo: never commit secrets.
- NEVER run `d1 migrations apply` without `--config wrangler.preview-migrations.jsonc`.
- **Production steps for Julio (in this order, in the report):**
  1. Before the `dev` → `main` release that contains D23, apply the migration to production (no tracking table there, so `execute`, not `migrations apply`), from the main checkout:
     `node --env-file=.env node_modules/wrangler/bin/wrangler.js d1 execute afroin --remote --file migrations/0012_add_event_end_date.sql`
     Verify: `node --env-file=.env node_modules/wrangler/bin/wrangler.js d1 execute afroin --remote --command "SELECT name FROM pragma_table_info('events') WHERE name='end_date'"` → one row.
  2. Release `dev` → `main` (Julio merges).
  3. In the production admin, edit "Pase Festival AFRO IN 2027 · Santa Marta" → "Último día" = 17/01/2027 → save. Until then the pass keeps today's behavior (fine before 15 Jan).
  4. Record 0012 in the work list's *Applied in production*.
- Copy rules (Julio): no repeated info in a block, community tone; events pages say "Comprar entradas"/"entradas".
- Report to the orchestrator: branch, SHAs, validation, review artifact path, production command above.

> **UI Styling Note:** UI styling specifications (colors, sizes, variants, labels, spacing) are `[provisional]` proposals — expect them to change once the user sees the implementation. Implement as specified but do not over-invest in pixel-perfect adherence; plan for iteration.
>
> **Expected UX iterations: 2**
