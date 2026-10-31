# Plan: D13 — Staged ticket prices (presales) for any event

## Overview
Any event in the admin can have price stages (e.g. "Preventa 1" $20.000 × 50, "Preventa 2" $35.000 × 150, "General" $45.000 × 150), each with its own dates and quota. The server picks the current stage by Bogotá date and stage sales, charges that price at checkout (never the client's), and the admin shows sales per stage. A started payment holds its tickets for 30 minutes so a cheap, small stage is not oversold. Events without stages keep working exactly as today (single price + capacity).

## Requirements Summary
Decided by Julio on 2026-10-31 (planning session):
- **Generic feature**: every event can have stages; which 2027 event uses them is decided later (Q1).
- **Sold-out stage → next stage starts at once**, even before its start date (Q2).
- **A stage ended by date loses its unsold tickets**: each stage sells only its own quota (Q3).
- **No extra registration**: the web purchase form (name, email, phone) is the "registro en afroin.org" (Q4).
- **Afro Batalla is NOT in D13** (D14) (Q5).
- **COP only, through Bold** (Q6).
- **Quantity above the stage's remaining tickets is refused**: "Solo quedan N entradas a este precio"; no split orders (Q7).
- **Public event page shows the current stage + price AND the full stage list** (past, sold out, current, upcoming) (Q8).
- **A started payment holds its tickets for 30 minutes**; unpaid holds free themselves (Q9).
- Checkout charges the server-computed price; the client sends the price it showed only so the server can refuse with "price changed" (consent), never to set the charge.
- Admin: create/edit/delete stages inside the event form; see sold / quota / revenue per stage; the events grid shows the current stage.
- Emails, QR tickets, receipt and check-in unchanged.
- Workflow classification: **sequential user-driven** (admin save = one commit handler; buyer checkout = one submit). No reactive effects.

## Out of Scope
- Afro Batalla registration (D14).
- USD / PayPal.
- Access codes or pre-registered email lists for a stage (possible follow-up; Julio chose "nothing extra").
- One order mixing two stage prices.
- Choosing which 2027 event uses stages, and loading the real 2027 stages in production (Julio, in the production admin).
- Changing `EditionTickets.astro`, `src/lib/programacion.ts` or `src/content/tour2027/*` before D16 (PR juliochemoreno/afro-in#11) is merged into `dev`.
- Emails (Resend) — v1 has none; unchanged.

## Likely Follow-ups
- Render the 2027 tiers block from the D1 stages (server island) instead of the static content tiers, so there is one source of truth.
- Per-stage access code ("solo con registro") if Julio wants to restrict stage 1 later.
- Stage name column / filter in the ticket orders dashboard exports.
- Discount codes (ticketing v2 list).

## Git Strategy
- **Base branch:** `dev` (worktree branch `claude/d13-staged-tickets-0aa889`, already cut from `dev`; rebase/sync on `origin/dev` before the PR).
- **Feature branch:** `claude/d13-staged-tickets-0aa889` (this worktree's branch; one PR to `dev`).

## Context References
Verified during planning (2026-10-31, branch at `3a78c0a`):
- `migrations/0008_create_ticketing.sql` — `events(price INTEGER NOT NULL, capacity INTEGER NOT NULL, event_date TEXT 'YYYY-MM-DDTHH:MM' Bogotá wall clock)`, `ticket_orders(status 'pending'|'completed'|'rejected', unit_price, quantity, created_at DEFAULT CURRENT_TIMESTAMP (UTC 'YYYY-MM-DD HH:MM:SS'), tickets_issued)`, `tickets(event_id, ticket_order_id, status)`. Last migration is `0010_create_admins.sql` → next is **0011**.
- `src/lib/tickets.ts`
  - `:76-79` `nowBogotaWallClock()` (UTC−5, no DST).
  - `:122-126` `toPublic` computes `sold/remaining/soldOut` from `events.capacity`.
  - `:129-142` `getVisibleEvents` (used by `src/templates/EventosIndexTemplate.astro:18`).
  - `:145-162` `getEventBySlug` (used by `src/pages/eventos/[slug].astro:8`, `en/events/[slug].astro:8`, `fr/evenements/[slug].astro:8`).
  - `:185-310` `createPendingTicketOrder`: price from `events.price` (`:227`), capacity check counts **issued tickets only** (`:231-241`, comment admits the oversell window), unguarded `INSERT` (`:260-286`), free orders insert order + tickets in one batch (`:291-294`); ticket inserts select the order by `bold_order_id`, so they insert nothing if the order row was not inserted (`:89-92`).
  - `:331-410` `createCourtesyTicketOrder` (capacity check `:357-365`).
  - `:443-518` `issueTicketsForOrder` — issues even when over capacity (logs "Ticket oversell"); unchanged.
  - `:655-672` `getEventsForAdmin`; `:674-687` `getTicketOrdersForAdmin`.
- `src/pages/api/tickets/checkout.ts:31-41` — maps `CheckoutError` → `{ error }` with `e.status`; signs the server `order.amount` for Bold (`:56-62`).
- `src/lib/orders.ts:9` `BOLD_MIN_AMOUNT = 1000`; `:20-26` `CheckoutError(message, status)`.
- `src/lib/eventAdmin.ts` — `EVENT_COLUMNS`, `validateEventInput`, `eventValues`.
- `src/pages/api/admin/events/index.ts:23-51` (POST, `requireAdmin` at `:24`) and `src/pages/api/admin/events/[id].ts:14-45` (PUT, `requireAdmin` at `:15`), DELETE `:76-120` refuses when orders exist.
- `src/pages/admin/eventos/[id].astro:10-17` loads `SELECT * FROM events WHERE id = ?` and passes it to `EventForm`.
- `src/components/admin/EventForm.tsx` — `save()` `:376-410` (single POST/PUT, then redirect to `/admin/eventos`), "Precios y Capacidad" card `:720-775`.
- `src/components/EventsDashboard.tsx:256` price column; `:76-81` sold/capacity bar.
- `src/templates/EventoSlugTemplate.astro:110-145` price fact + `TicketCheckoutForm` props (`price`, `remaining`).
- `src/components/TicketCheckoutForm.tsx:55-130` — `maxQty = min(10, remaining)`, POST `/api/tickets/checkout` with `{eventSlug, quantity, buyer}`, shows `data.error` on failure.
- `src/templates/EventosIndexTemplate.astro:75` shows `formatPrice(e.price)`.
- `src/i18n/locales/{es,en,fr}.json:312-351` — `tix.*` keys.
- `tests/*.test.ts` run with `node --experimental-strip-types --test` → test-imported modules must use **relative `.ts` imports, no `@/` alias** (e.g. `tests/programacion.test.ts:3-18`). `src/lib/tickets.ts` imports `@/lib/bold`, so the pure stage logic goes in a new alias-free module.
- `seeds/preview.sql:11-16` — fake staging events (`dev-evento-de-prueba`, price 1000).
- Search for every reader of the changed rules: `grep -rn "getVisibleEvents\|getEventBySlug\|getEventsForAdmin\|getTicketOrdersForAdmin" src` → 7 call sites in 6 files (listed above); `grep -rn "price" src/components/TicketCheckoutForm.tsx src/templates/EventoSlugTemplate.astro src/templates/EventosIndexTemplate.astro src/components/EventsDashboard.tsx` → all covered by Tasks 6–8.
- D16 status: merged into `dev` (`c479db4`, `origin/dev` = `a50ff81`, per the orchestrator 2026-10-31). On D16's branch the tiers live in `src/content/tour2027/santa-marta.md` (`tickets.tiers[] {period, from, until, price, note}`) and `SALES.tickets.url = ""` in `src/lib/programacion.ts:119-122`.

## Domain Assumptions
Confirm or correct each before execution:
1. **Stage dates are whole days in Bogotá time**: `starts_on` and optional `ends_on` (`YYYY-MM-DD`, inclusive). A stage with no `ends_on` runs until the event starts. Stage 1 "1–15 Nov" = `2026-11-01`..`2026-11-15`.
2. **Current stage rule** (stages ordered by `starts_on`): skip stages whose `ends_on` is past; a stage whose quota is full is "agotada" and lets the next stage open immediately; the first remaining stage is current if its `starts_on` has arrived **or** an earlier stage sold out. Otherwise sales are "not open yet" (page shows "La venta abre el {fecha}"). If no stage remains → "Agotado". An early-opened stage keeps its own `ends_on`.
3. **Event "Cupo" stays the total ceiling** (it also covers courtesy tickets). A sale must fit both the stage quota and the event cupo. The admin shows the sum of stage quotas next to the cupo but does not force them to match.
4. **Courtesy tickets** count against the event cupo only, never against a stage quota.
5. **30-minute hold applies to every paid event**, staged or not: remaining = quota − issued tickets − tickets in `pending` orders created in the last 30 minutes. A rejected payment frees its hold at once. A payment approved after its hold expired still gets its tickets (as today) and logs an oversell.
6. **Editing a stage that already has sales** is allowed (price, dates, quota): past orders keep the price they paid. **Deleting** a stage that has orders is refused ("La etapa tiene órdenes"), like events today.
7. **Stage price rules = event price rules**: 0 (free) or ≥ 1.000 COP (Bold minimum); quota ≥ 1; at most 10 stages; dates must not overlap; only the last stage may omit `ends_on`; no stage may start after the event day.
8. With stages, the event's own "Precio" field is hidden in the admin; the server stores the first stage's price in `events.price` so older readers still see a sensible number.
9. **Stage names** in es/en/fr (es required; en/fr fall back to es), e.g. "Preventa 1".
10. **Price changed between page load and pay** (stage moved on): checkout refuses with "El precio cambió a $X" and the form shows the new price; the buyer clicks again to accept.

## Implementation Tasks

### Phase 1 — Data model and pure stage logic

### Task 1: Add migration 0011 for price stages
- **Action:** create
- **File:** `migrations/0011_create_event_price_stages.sql`
- **Pattern:** `migrations/0008_create_ticketing.sql` (comment header, `IF NOT EXISTS`, indexes)
- **Details:**
  ```sql
  CREATE TABLE IF NOT EXISTS event_price_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name_es TEXT NOT NULL, name_en TEXT, name_fr TEXT,
    price INTEGER NOT NULL,          -- COP
    capacity INTEGER NOT NULL,       -- stage quota
    starts_on TEXT NOT NULL,         -- YYYY-MM-DD, Bogotá, inclusive
    ends_on TEXT,                    -- YYYY-MM-DD inclusive; NULL = until the event
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_event_price_stages_event ON event_price_stages(event_id, starts_on);
  ALTER TABLE ticket_orders ADD COLUMN stage_id INTEGER REFERENCES event_price_stages(id);
  CREATE INDEX IF NOT EXISTS idx_ticket_orders_stage ON ticket_orders(stage_id);
  CREATE INDEX IF NOT EXISTS idx_ticket_orders_pending ON ticket_orders(event_id, status, created_at);
  ```
  Additive only: old code ignores the new table/column. Also add to `seeds/preview.sql` one fake staged event `dev-evento-por-etapas` (3 stages at 1000/1500/2000 COP, tiny quotas 2/2/2; stage 1 from `2026-10-01`, stage 2 starting in the future) with `INSERT OR IGNORE` + `(SELECT id FROM events WHERE slug = …)`.
- **Gotcha:** SQLite `ALTER TABLE ADD COLUMN` with `REFERENCES` is allowed only with a NULL default (it is). Never run `d1 migrations apply` without `--config wrangler.preview-migrations.jsonc`. Production migration is Julio's, applied BEFORE merging to `main`.
- **Validate:** `npx wrangler d1 execute DB --local --env local --file migrations/0011_create_event_price_stages.sql` then `--command "PRAGMA table_info(ticket_orders)"` shows `stage_id`; re-running the CREATE parts is harmless.

### Task 2: Create the pure stage logic module (TDD)
- **Action:** create
- **File:** `src/lib/ticketStages.ts` (+ `tests/ticket-stages.test.ts`, written first)
- **Pattern:** `src/lib/programacion.ts` + `tests/programacion.test.ts` (alias-free module, `node:test`)
- **Details:** No `@/` imports. Exports:
  - `type StageRow = { id; event_id; name_es; name_en; name_fr; price; capacity; starts_on; ends_on: string|null }`, `type StageWithSales = StageRow & { sold: number; held: number }`.
  - `bogotaToday(now = new Date()): string` → `YYYY-MM-DD` (UTC−5, same math as `tickets.ts:76-79`); also move `nowBogotaWallClock` here and re-export/import it from `tickets.ts` (single source).
  - `stageStatuses(stages, today)` → each stage + `status: "past" | "soldout" | "current" | "upcoming"` + `remaining = max(0, capacity − sold − held)`, implementing Domain Assumption 2 (sort by `starts_on`, then `id`).
  - `resolveSale(stages, today)` → `{ state: "current", stage, remaining } | { state: "upcoming", opensOn } | { state: "ended" }`.
  - `validateStages(input: unknown, opts: { eventDate: string; minAmount: number }): { stages: CleanStage[] } | { error: string }` implementing Domain Assumption 7 (Spanish admin messages, like `eventAdmin.ts`). `CleanStage` keeps an optional numeric `id` for updates.
  - `stageName(stage, lang)` with es fallback.
- **Gotcha:** "Sold out" uses `sold + held >= capacity` (held = 30-min pending holds) so the next stage opens while the last tickets are held; if a hold expires the earlier stage reappears as current — acceptable and covered by a test. Compare ISO dates as strings only (formats are validated).
- **Validate:** `node --experimental-strip-types --test tests/ticket-stages.test.ts` — cases: before first stage (upcoming), inside stage 1, stage 1 sold out on day 5 → stage 2 current early, stage 1 ended by date with leftovers → stage 2 only when its date arrives (gap → upcoming), all sold/past → ended, last stage without `ends_on`, hold makes stage full, Bogotá midnight boundary (`2026-11-16T04:59Z` is still the 15th), validation errors (overlap, missing ends_on on a non-last stage, price 500, >10 stages, start after event day).

**Commit 1** (Phase 1): Task 1 + Task 2 with `tests/ticket-stages.test.ts` (green).

### Phase 2 — Server money path

### Task 3: Price stages in the ticket data layer and checkout
- **Action:** modify
- **File:** `src/lib/tickets.ts`
- **Pattern:** existing batch/guarded-statement style in `issueTicketsForOrder` (`:483-512`)
- **Details:**
  1. `HOLD_MINUTES = 30`; SQL fragment for "held" = `SUM(quantity) FROM ticket_orders WHERE status='pending' AND created_at > datetime('now','-30 minutes')` (per event and per stage).
  2. `loadStagesWithSales(db, eventIds: number[])` — ONE query for all stages of the given events with `sold` (tickets joined to orders by `stage_id`) and `held`; no per-event loop (N+1).
  3. `PublicEvent` gains `stages: (StageWithSales & {status, remaining})[]`, `sale: ReturnType<typeof resolveSale> | null`. In `toPublic`, for staged events: `price` = current stage price (or next stage price when upcoming), `remaining` = min(stage remaining, event remaining), `soldOut` = `sale.state === "ended"` or event full. Event `remaining` subtracts holds too. `getVisibleEvents` / `getEventBySlug` call `loadStagesWithSales` once.
  4. `createPendingTicketOrder(db, input, options)`: accept optional `input.expectedUnitPrice`. After loading the event, load its stages; if any: `resolveSale(…, bogotaToday())`; `upcoming` → `CheckoutError("La venta aún no está abierta")`; `ended` → `"Entradas agotadas"`; `unit = stage.price`; `qty > remaining` → `"Solo quedan ${remaining} entradas a este precio"` (no stages: keep today's messages). If `expectedUnitPrice` is a number and ≠ `unit` → throw `PriceChangedError` (new subclass of `CheckoutError`, status 409, carries `unitPrice`). Insert `stage_id`.
  5. **Atomic capacity guard**: change the order INSERT to `INSERT … SELECT … WHERE (issued_event + held_event + ?qty) <= events.capacity [AND (issued_stage + held_stage + ?qty) <= stage.capacity]`, then check `meta.changes` (paid) or the first batch result (free); 0 changes → `CheckoutError("Solo quedan … entradas")` after re-reading the count. D1 serializes writes, so two concurrent buyers cannot both pass.
  6. `createCourtesyTicketOrder`: capacity check includes holds (event level only).
  7. `getEventsForAdmin`: add per event `stages` (with sold, held, revenue = `SUM(amount)` of completed orders… computed per stage as `SUM(unit_price*quantity)` of completed orders with that `stage_id`) and `current_stage_name` / `current_price` via `loadStagesWithSales` + `resolveSale` (one extra query total).
  8. `getTicketOrdersForAdmin`: `LEFT JOIN event_price_stages s ON s.id = o.stage_id` → `stage_name`.
- **Gotcha:** `created_at` is UTC `YYYY-MM-DD HH:MM:SS`; compare with `datetime('now', …)` (same format), never with the Bogotá wall clock. Free stage (price 0) still completes immediately (existing free path). `issueTicketsForOrder` stays unchanged (pays first, logs oversell). Bold signs `order.amount` = server `unit * qty` — unchanged contract.
- **Validate:** `npx tsc --noEmit` clean for this file; curl matrix in Level 4.
- **Time-box:** 60 min for the guarded INSERT … SELECT. Fallback: keep the read-then-insert check but run it inside the same `db.batch` as a conditional insert by slug (same guarantee via `WHERE` subquery).

### Task 4: Checkout endpoint returns "price changed"
- **Action:** modify
- **File:** `src/pages/api/tickets/checkout.ts`
- **Pattern:** existing `CheckoutError` branch (`:35-41`)
- **Details:** `instanceof PriceChangedError` → `json({ error: e.message, code: "price_changed", unitPrice: e.unitPrice }, 409)` before the generic `CheckoutError` branch. Nothing else changes (Bold signature still from the server amount).
- **Validation:** `expectedUnitPrice` optional integer; non-numeric → ignored (old cached clients keep working); payload limit unchanged (4096 B).
- **Error UX:** form shows the translated "El precio cambió a {price}…" message and updates the displayed price (Task 8).
- **Validate:** curl with a wrong `expectedUnitPrice` → 409 `code=price_changed`; with the right one → 201 and `amount = price*qty`; with a forged `amount`/`price` field in the body → ignored.

### Task 5: Admin API saves stages with the event
- **Action:** modify
- **File:** `src/lib/eventAdmin.ts`, `src/pages/api/admin/events/index.ts`, `src/pages/api/admin/events/[id].ts`
- **Pattern:** `ticketInserts` (find parent row by unique key inside the same batch, `tickets.ts:83-101`)
- **Details:**
  - `eventAdmin.ts`: `stageStatements(db, eventRef, stages, existingIds)` building INSERT/UPDATE/DELETE statements; when stages exist, `eventValues` writes `price = stages[0].price`.
  - POST: if `body.stages` (array) → `validateStages(body.stages, { eventDate: body.event_date, minAmount: BOLD_MIN_AMOUNT })`; one `db.batch([insertEvent, ...stageInserts])` with `event_id = (SELECT id FROM events WHERE slug = ?)`.
  - PUT: `stages` key absent → stages untouched (backward compatible). Present (array, may be empty) → load current stage ids for this event; ids in the body must belong to this event (else 400); removed ids with orders (`SELECT COUNT(*) FROM ticket_orders WHERE stage_id IN …`) → 409 "La etapa «X» tiene órdenes; no se puede borrar"; then one `db.batch([updateEvent, ...updates (WHERE id=? AND event_id=?), ...inserts, ...deletes])`.
  - Both keep `requireAdmin` as the first line (already present).
- **Validation:** see `validateStages` (Domain Assumption 7); body still JSON; stages array ≤ 10.
- **Error UX:** `{ error }` 400/409 shown in the form's existing error banner.
- **Validate:** curl as admin (cookie from `/api/admin-login` locally): create event with 3 stages → rows in D1; PUT reorder/edit → updated; PUT removing a stage with an order → 409; request without cookie → 401.

**Commit 2** (Phase 2): Tasks 3–5 (no new test files; `tests/ticket-stages.test.ts` still green).

### Phase 3 — Admin and public UI

### Task 6: Stage editor and per-stage sales in the admin
- **Action:** modify
- **File:** `src/pages/admin/eventos/[id].astro`, `src/components/admin/EventForm.tsx`, `src/components/EventsDashboard.tsx`
- **Pattern:** existing "Precios y Capacidad" card (`EventForm.tsx:720-775`), shadcn `Input`/`Button`/`Switch`; lucide-react icons
- **Details:**
  - `[id].astro`: also load the event's stages with sales (reuse `loadStagesWithSales`) and pass `stages` to `EventForm`.
  - `EventForm`: switch "Precios por etapas"; when on, the single price input is replaced by a list of stage rows (name ES/EN/FR following the form's language tabs, price, quota, start date, end date optional on the last row, delete button disabled with tooltip when the stage has sales), "Agregar etapa" button, and per row a read-only line "Vendidas 12 / 50 · $240.000 · Actual/Agotada/Próxima/Terminada". Shows "Suma de cupos de etapas: 350 · Cupo total: 350". `save()` sends `stages` (array, or `[]` when the switch is turned off on an event that had stages) in the same POST/PUT. Client-side checks mirror `validateStages` by importing it (pure module) so errors show before saving.
  - `EventsDashboard`: price column shows `current_price` + small stage name badge when the event has stages.
- **Gotcha:** Turning the switch off on an event whose stages have orders → server 409; show the message. Keep the form's single-commit `save()` (no auto-save effects).
- **Validate:** `npm run check`; manual in `astro dev` (Level 5 item A).

### Task 7: Public event page shows current stage and all stages
- **Action:** modify
- **File:** `src/templates/EventoSlugTemplate.astro`, `src/templates/EventosIndexTemplate.astro`, `src/i18n/locales/es.json`, `en.json`, `fr.json`
- **Pattern:** existing `evento-facts` list and `t()` keys `tix.detail.*`
- **Details:**
  - Price fact: "{stage name} · $35.000" when staged. Below the facts, a "Precios" list of all stages: name, date range (localized), price; status styling: past/sold-out struck through with "Agotada"/"Terminada", current highlighted "Ahora", upcoming "Próximamente".
  - `sale.state === "upcoming"` → replace the buy form with "La venta abre el {date}"; `ended` → existing sold-out block.
  - `remaining` passed to the form = stage-aware `event.remaining`; low-stock line "Quedan N" stays as today (≤ 20) — wording "a este precio" only for staged events.
  - `EventosIndexTemplate`: card price already reads `e.price` (now the current stage price) — add "Desde" nothing; just verify it renders.
  - New keys (es/en/fr): `tix.stages.title`, `tix.stages.now`, `tix.stages.soldout`, `tix.stages.ended`, `tix.stages.upcoming`, `tix.stages.opens`, `tix.form.err.pricechanged`, `tix.detail.remaining.stage`.
- **Gotcha:** These pages are SSR (`prerender = false`), so prices are fresh on every load. Home pages are not touched (rule 4).
- **Validate:** `npm run check`; open `/eventos/dev-evento-por-etapas`, `/en/events/…`, `/fr/evenements/…` locally.

### Task 8: Checkout form sends the shown price and handles "price changed"
- **Action:** modify
- **File:** `src/components/TicketCheckoutForm.tsx`
- **Pattern:** existing `submit()` (`:96-130`)
- **Details:** Keep `price` in state (`useState(price)`); send `expectedUnitPrice: currentPrice`; on 409 with `code === "price_changed"` set the new price, show `t["tix.form.err.pricechanged"]` with the formatted price, stop (the buyer clicks Pay again to accept). Other errors unchanged.
- **Gotcha:** The server, not this value, sets the charge; this field only protects the buyer's consent.
- **Validate:** local: load the staged event page, change the current stage price in the admin, click Pay → message + new total; click again → Bold opens with the new amount.

**Commit 3** (Phase 3): Tasks 6–8.

### Phase 4 — 2027 tickets block (D16 merged into `dev` at `c479db4`; still waits for Julio to name the event)

### Task 9: Point the 2027 tickets block at the staged event
- **Action:** modify
- **File:** `src/lib/programacion.ts` (`SALES.tickets.url`)
- **Pattern:** D16's `SALES` object
- **Details:** After `git merge origin/dev` brings D16 in, set `SALES.tickets.url` to the event page path Julio names (per language if D16 supports it). The static tiers in `src/content/tour2027/*` stay as D16 left them (live tiers from D1 = follow-up).
- **Gotcha:** Bring D16 in with `git merge origin/dev` (merge, not rebase). If Julio has not named the event when Phases 1–3 are done, ship the PR without Phase 4 and report it as pending.
- **Validate:** `npm test` (programacion tests) + the 2027 page links to the event.

## Test Tasks
- `tests/ticket-stages.test.ts` (Task 2) — all stage selection and validation rules, written first (RED → GREEN) and committed with Task 2.
- No D1 test harness exists (adding one = new dependency → Julio's OK): the SQL paths (holds, atomic guard, admin sync) are covered by the Level 4 curl matrix against local D1.
- Regression: an event WITHOUT stages buys, shows price and sells out exactly as before (Level 4 rows 1–2); courtesy tickets still work; check-in unchanged.

## Validation Checklist
- [ ] **Level 1 — Lint & Format:** no linter in this project (orchestrator.md).
- [ ] **Level 2 — Type Check / build:** `npm run check` (astro build + tsc + wrangler dry-run).
- [ ] **Level 2.5 — Code Review:** `/hopla:code-review` per phase (money path) + one fresh-context branch review before the PR + a design review of the money path (checkout price, guard, holds).
- [ ] **Level 3 — Unit Tests:** `npm test`.
- [ ] **Level 4 — Integration (local `astro dev`, local D1 with migrations + `seeds/local.sql` + staged seed, Bold TEST keys):** curl matrix:
  1. Unstaged event: checkout 201, `amount = price*qty` (regression).
  2. Unstaged event at capacity incl. a fresh pending hold → 400 "agotadas"; same hold older than 30 min (`UPDATE … created_at = datetime('now','-31 minutes')`) → 201.
  3. Staged event, stage 1 current: `amount = stage1.price*qty`; forged `price`/`amount` in body ignored.
  4. Qty > stage remaining → 400 "Solo quedan N entradas a este precio".
  5. Stage 1 full (issued + holds) → stage 2 price returned even though its date is future.
  6. `expectedUnitPrice` stale → 409 `price_changed`.
  7. Before first stage → 400 "La venta aún no está abierta"; all ended → "Entradas agotadas".
  8. Two parallel checkouts for the last ticket (`curl … & curl …`) → exactly one 201.
  9. Admin endpoints without cookie → 401; stage delete with orders → 409.
- [ ] **Level 5 — Human Review (Julio, on the branch's Worker Preview with Bold TEST mode, before merge to `dev`):**
  - A. Admin: create an event with 3 stages, edit one, try to delete one with sales; the form and the events grid read correctly. If skipped: admin UX ships unseen.
  - B. Public page es/en/fr: current stage + full list + "venta abre" state look right. If skipped: wording/styling ships unseen.
  - C. One Bold TEST purchase on the staged event: Bold shows the stage price; receipt + QR arrive; the stage's "Vendidas" increases. If skipped: the real Bold round trip with `stage_id` is unobserved.

## Acceptance Criteria
- [ ] An admin can add, edit and remove price stages on any event; events without stages behave as before.
- [ ] Checkout charges the current stage price computed on the server (Bogotá date + stage sales), never a client value.
- [ ] A sold-out stage opens the next one immediately; a stage ended by date does not carry its leftovers.
- [ ] A quantity above the stage's remaining tickets is refused with the "a este precio" message.
- [ ] A started payment holds its tickets for 30 minutes; the last ticket cannot be sold twice by concurrent checkouts.
- [ ] The public event page (es/en/fr) shows the current stage and all stages with their status.
- [ ] The admin shows sold / quota / revenue per stage.
- [ ] `npm run check` and `npm test` pass.
- [ ] Migration `0011` applied on staging (`--config wrangler.preview-migrations.jsonc`); production instructions in the report.

## Confidence Score: 8/10
- **Strengths:** ticketing v1 is small and well structured; the Bold contract (server-signed amount) does not change; stage logic is pure and fully unit-testable.
- **Uncertainties:** D1 behaviour of the guarded `INSERT … SELECT` + `meta.changes` in a batch (well-known SQLite pattern, unproven here); admin form size (845 lines) makes the stage editor the biggest UI change; D16 timing for Phase 4.
- **Mitigations:** Time-box + fallback on Task 3; curl row 8 proves the race guard; Phase 4 can ship separately.

## Notes for Executing Agent
- Money path: strongest model, code review per phase, never real payments (Bold TEST only, local/Preview). Production migration is Julio's; report the exact command: `npx wrangler d1 execute afroin --remote --file migrations/0011_create_event_price_stages.sql` (Julio runs it BEFORE the `dev` → `main` merge), and record it in the work list's *Applied in production*.
- Staging: `npx wrangler d1 migrations apply PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc --env-file=<main checkout>/.env`, then the staged seed rows (same config, `d1 execute --file`). Never print credentials.
- Every `/api/admin/*` keeps `requireAdmin`. All new user-facing text es/en/fr. lucide-react in React islands; `lucide-astro/<Icon>` per-icon imports in `.astro`.
- Do not touch `EditionTickets.astro`, `src/lib/programacion.ts`, `src/content/tour2027/*` until D16 is in `dev`.
- **UI Styling Note:** styling is provisional; expect iteration after Julio sees it.
- **Expected UX iterations: 3** (stage editor in the admin form, stage list on the public page).
