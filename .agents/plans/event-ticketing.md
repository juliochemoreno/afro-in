# Plan: Event Ticketing (Phase 3 — AFRO IN roadmap)

## Overview

Sell event tickets online through the existing Bold payment infrastructure. Admins create events in the panel; visitors buy tickets on public localized pages (es/en/fr); each ticket gets a unique QR code reachable through a permanent token link (no email in v1); staff validates tickets at the door with a camera QR scanner (cross-browser) or manual code entry, behind the existing admin login.

## Requirements Summary

- Events managed via admin CRUD (like products) + public listing/detail pages in es/en/fr.
- Single price + total capacity per event (no ticket tiers in v1).
- Purchase flow: buyer enters name/email/phone + quantity → Bold checkout (same pattern as store) → success page shows tickets.
- One QR code per ticket (individual check-in per attendee).
- No email provider in v1: success page + **permanent token link** the buyer can save/share + manual WhatsApp follow-up.
- Ticket quota checked at payment confirmation time (decision from design session; see Domain Assumptions for the exact mechanics).
- Check-in: web app usable on Android AND iPhone → `BarcodeDetector` where available + library fallback for Safari/iOS + manual code entry fallback. Lives under `/admin` (admin session).
- Reuse Bold plumbing: `generateOrderId('ticket')` → `AFROIN-TIX-<uuid>` ids (already implemented), add `CONFIRM_TARGETS.ticket`, single webhook already routes by prefix.
- Migrations start at `0008`.

## Out of Scope

- Email delivery of tickets (Resend deferred to v2).
- Ticket tiers (General/VIP/Early bird) — v2.
- Refunds/cancellations flow — manual via Bold panel + WhatsApp in v1.
- Seat maps / numbered seating.
- Integration with the static `/programacion` content pages (tour2026 collection) — public ticketing lives in its own `/eventos` section; a manual link from programación content can be added later by editing those markdown files.
- Per-event staff PIN for check-in (admin login only in v1).
- Discount codes.

## Likely Follow-ups

- Link "Comprar entradas" buttons from `/programacion/[slug]` pages to the matching `/eventos/[slug]` page.
- Email delivery of tickets via Resend (v2).
- Ticket tiers with per-tier price/quota.
- Check-in stats live view (sold vs checked-in counter) on the scanner page — a basic counter IS included in v1's scanner page; a richer dashboard is follow-up.
- Export attendee list (CSV) from admin.

## Git Strategy

- **Base branch:** `main` (GitHub Flow — no develop branch exists)
- **Feature branch:** `feature/event-ticketing`

## Context References

Key files the executing agent must read before starting (all verified 2026-07-02):

- `src/lib/bold.ts` — Bold helpers. **Verified:** `generateOrderId("ticket")` already emits `AFROIN-TIX-<uuid>` (lines 20–32); `orderKindFromId` already recognizes `AFROIN-TIX-` (line 37); `extractOrderId` regex already matches the `TIX-` infix (line 200). `ConfirmTarget.table` is a union `"donors" | "orders"` (line 137) — must be extended. `CONFIRM_TARGETS` is `Record<"donation" | "order", ConfirmTarget>` (line 141) — must be extended. `confirmTargetForOrder` (lines 147–151) returns donation target for tickets today — must be extended. `confirmBoldOrder` (lines 160–192) does an idempotent `UPDATE <table> SET status/provider_status/transaction_id/<ts> WHERE bold_order_id = ? AND status='pending'` and returns `changed` — the new `ticket_orders` table MUST have exactly these columns: `bold_order_id`, `status` (`'pending'|'completed'|'rejected'`), `provider_status`, `transaction_id`, `paid_at`.
- `src/lib/orders.ts` — reference pattern for server-side re-pricing + pending-row creation (`createPendingOrder`, lines 88–216). `BOLD_MIN_AMOUNT = 1000` COP (line 8) — tickets must enforce it too. Note `clean()` helper and `CheckoutError` with HTTP status.
- `migrations/0007_create_orders.sql` — schema style to mirror (Bold columns block, integer COP amounts, snapshot columns, indexes).
- `src/pages/api/store/checkout.ts` — endpoint pattern: payload size cap (20KB), JSON parse guard, Bold keys check, `createPendingOrder`, `generateIntegritySignature(orderId, amountStr, "COP", BOLD_SECRET_KEY)`, returns `{orderId, integritySignature, apiKey, amount, currency}` with 201.
- `src/pages/api/store/confirm.ts` — endpoint pattern: `confirmBoldOrder(db, BOLD_API_KEY, orderId, CONFIRM_TARGETS.order)` then re-reads the row + children and returns a receipt payload.
- `src/pages/api/bold-webhook.ts` — single webhook; `confirmTargetForOrder(orderId)` routes by prefix (lines 41–46). Ticket issuance hook goes here (post-confirm side effect).
- `src/components/CheckoutForm.tsx` — Bold browser flow to copy: lazy-load SDK from `https://checkout.bold.co/library/boldPaymentButton.js`, POST to checkout API, `sessionStorage.setItem("store_order_id", ...)`, build `boldConfig` (`orderId/currency/amount/apiKey/integritySignature/description/customerData`), `redirectionUrl` only when origin is HTTPS, `new window.BoldCheckout(config).open()`.
- `src/components/OrderReceipt.tsx` — receipt island pattern: reads `bold-order-id` query param → fallback `sessionStorage` → POST confirm API → phase machine `loading|success|pending|failed`.
- `src/lib/adminAuth.ts` — `requireAdmin(context)` + `adminUnauthorized()` (lines 50–64). **Every** `/api/admin/*` endpoint must call it (middleware only guards admin PAGES — verified in `src/middleware.ts` lines 14–24).
- `src/pages/api/admin/products/index.ts`, `[id].ts`, `upload.ts` — admin CRUD + R2 upload pattern to follow for events.
- `src/components/ProductsDashboard.tsx` + `src/components/admin/AdminGrid.tsx` — AG Grid admin dashboard pattern (themeQuartz, dark-mode sync, flex h-full min-h-0 layout).
- `src/components/admin/ProductForm.tsx` — admin form pattern (Shopify-style, language switcher for localized fields, sticky save bar).
- `src/layouts/AdminLayout.astro` — sidebar `navItems` array at lines 26–31 (desktop nav ~line 88, mobile nav ~line 150 — both iterate the same array). Icons come from `lucide-astro`.
- `src/i18n/routes.ts` — localized route keys per lang; add `events` + `tickets`. `src/i18n/locales/{es,en,fr}.json` — UI strings (see existing `checkout.*` / `order.*` keys as naming reference).
- `src/pages/tienda/index.astro` + `src/templates/TiendaIndexTemplate.astro` — SSR public page pattern (`export const prerender = false`, reads D1 via `Astro.locals.runtime.env.DB`).
- `wrangler.json` — bindings: `DB` (D1 `afroin`), `MEDIA` (R2 `afroin-media`), `ASSETS`.

**Data audit findings:**
- `orders`/`donors` share the Bold column contract consumed by `confirmBoldOrder`; the string-interpolated table/column names are safe ONLY because they come from the hardcoded `CONFIRM_TARGETS` whitelist — keep the new target inside that whitelist, never parameterize from input.
- Amounts are integer COP everywhere (no decimals). Bold signature uses the amount **string** exactly as sent.
- `status` vocabulary is `pending | completed | rejected` across tables — reuse it for `ticket_orders`. Ticket rows themselves use a separate lifecycle (`valid | checked_in`), created ONLY after payment completes.
- D1 has no transactions across statements; use `db.batch()` for multi-insert atomicity (pattern in `createPendingOrder` lines 198–213).
- No test framework exists in the project (no test script, no vitest/jest dep) — validation is `npm run check` + manual curl/browser matrix (see Test Tasks).

## Domain Assumptions

> The user was away when scope questions were asked; the recommended defaults below were adopted. **Confirm or correct each bullet before execution.**

- **Events model:** admin CRUD (`/admin/eventos`) + public section `/eventos` (es), `/en/events`, `/fr/evenements` with listing and detail pages — confirm.
- **Single price + single capacity per event** (no tiers in v1) — confirm.
- **One QR per ticket:** buying 3 tickets issues 3 individual codes/QRs, each checked in separately — confirm.
- **Check-in auth:** scanner page lives at `/admin/checkin` behind the existing admin session (no staff PIN in v1) — confirm.
- **Quota mechanics (oversell window accepted):** capacity is enforced at checkout creation (`issued tickets + requested qty ≤ capacity`) and re-checked at confirmation, but a pending Bold payment does NOT reserve seats. Two buyers paying simultaneously for the last seats can briefly oversell; tickets are still issued (money was taken) and the event auto-blocks further sales; resolution is manual via WhatsApp. Accepted for v1 — confirm.
- **Ticket order ≠ store order:** ticket purchases live in their own `ticket_orders` table (not mixed with store `orders`), with quantity of a SINGLE event per purchase (no multi-event cart) — confirm.
- **Permanent link semantics:** anyone holding the token URL can view the tickets/QRs (bearer link, like the design decision "permanent token link"). Codes are single-use at the door regardless — confirm.
- **Event visibility:** `visible=0` hides the event from public listing AND blocks new checkouts, but existing tickets remain valid for check-in — confirm.
- **Past events:** events whose date already passed are hidden from the public listing and refuse new checkouts — confirm.

## Requirements Delta

### ADDED Requirements
- REQ-TIX-001: Admin event management
  - Scenario: create — Given an authenticated admin, When they create an event with localized name/description, venue, city, date, price (COP int) and capacity, Then it appears in `/admin/eventos` and (if visible and future-dated) on the public listing.
- REQ-TIX-002: Public ticket purchase
  - Scenario: buy — Given a visible future event with remaining capacity, When a visitor submits name/email(/phone) + quantity and completes the Bold payment, Then a `ticket_orders` row transitions `pending → completed` and `quantity` ticket rows with unique codes are issued.
- REQ-TIX-003: Ticket delivery without email
  - Scenario: receipt — Given a completed ticket order, When the buyer lands on the success page (or reopens the permanent token link later), Then all tickets render with QR + human-readable code and the permanent link is shown for saving/sharing.
- REQ-TIX-004: Door check-in
  - Scenario: scan-valid — Given a staff member on `/admin/checkin`, When they scan (or type) a valid un-used code, Then the ticket becomes `checked_in` with timestamp and the UI confirms attendee/event.
  - Scenario: scan-duplicate — Given an already checked-in code, When scanned again, Then the UI warns "already checked in at <time>" and does NOT double-count.
- REQ-TIX-005: Capacity enforcement
  - Scenario: sold-out — Given an event whose issued tickets ≥ capacity, When a visitor tries to check out, Then the API rejects with a sold-out message and the public page shows sold-out state.

## Implementation Tasks

> Phased — commit at each phase boundary (see Phase Boundaries).

### — PHASE A: Data layer & Bold plumbing —

### Task 1: Create ticketing migration
- **Action:** create
- **File:** `migrations/0008_create_ticketing.sql`
- **Pattern:** `migrations/0007_create_orders.sql`
- **Details:** Three tables.
  - `events`: `id INTEGER PK AUTOINCREMENT`, `slug TEXT NOT NULL UNIQUE`, `name_es TEXT NOT NULL`, `name_en TEXT`, `name_fr TEXT`, `description_es TEXT`, `description_en TEXT`, `description_fr TEXT`, `venue TEXT`, `city TEXT`, `event_date TEXT NOT NULL` (ISO 8601, e.g. `2026-01-17T20:00`), `price INTEGER NOT NULL` (COP), `capacity INTEGER NOT NULL`, `image_r2_key TEXT`, `visible INTEGER NOT NULL DEFAULT 1`, `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`, `updated_at TEXT`. Index on `visible, event_date`.
  - `ticket_orders`: Bold contract columns EXACTLY as `orders` (`bold_order_id TEXT NOT NULL UNIQUE` — `AFROIN-TIX-<uuid>`, `status TEXT NOT NULL DEFAULT 'pending'`, `provider TEXT NOT NULL DEFAULT 'bold'`, `provider_status TEXT`, `transaction_id TEXT`, `currency TEXT NOT NULL DEFAULT 'COP'`, `amount INTEGER NOT NULL`, `paid_at TEXT`) plus: `event_id INTEGER NOT NULL REFERENCES events(id)`, `event_name TEXT NOT NULL` (snapshot of name_es), `unit_price INTEGER NOT NULL` (snapshot), `quantity INTEGER NOT NULL`, `buyer_name TEXT NOT NULL`, `buyer_email TEXT NOT NULL`, `buyer_phone TEXT`, `access_token TEXT NOT NULL UNIQUE` (permanent-link bearer token), `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`. Indexes on `status`, `event_id`, `access_token`.
  - `tickets`: `id INTEGER PK AUTOINCREMENT`, `ticket_order_id INTEGER NOT NULL REFERENCES ticket_orders(id) ON DELETE CASCADE`, `event_id INTEGER NOT NULL`, `code TEXT NOT NULL UNIQUE` (10-char Crockford base32, unambiguous, manual-entry friendly), `status TEXT NOT NULL DEFAULT 'valid'` (`valid | checked_in`), `checked_in_at TEXT`, `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`. Indexes on `ticket_order_id`, `event_id`, `code`.
- **Gotcha:** `confirmBoldOrder` interpolates table + timestamp column names — `ticket_orders` MUST have `bold_order_id`/`status`/`provider_status`/`transaction_id`/`paid_at` spelled exactly like this. Apply with `npx wrangler d1 execute afroin --local --file=migrations/0008_create_ticketing.sql` (LOCAL now; REMOTE only at deploy time).
- **Validate:** `npx wrangler d1 execute afroin --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('events','ticket_orders','tickets')"` returns 3 rows.

### Task 2: Extend Bold confirm targets for tickets
- **Action:** modify
- **File:** `src/lib/bold.ts`
- **Pattern:** existing `CONFIRM_TARGETS.order` entry (lines 136–151)
- **Details:** (1) Widen `ConfirmTarget.table` union to `"donors" | "orders" | "ticket_orders"` (timestampColumn already includes `paid_at`). (2) Extend `CONFIRM_TARGETS` to `Record<"donation" | "order" | "ticket", ConfirmTarget>` adding `ticket: { table: "ticket_orders", timestampColumn: "paid_at" }`. (3) Rewrite `confirmTargetForOrder` as a lookup: `CONFIRM_TARGETS[orderKindFromId(orderId) === "donation" ? "donation" : kind]` — i.e. map kind→target directly for all three kinds.
- **Gotcha:** Do NOT touch `generateOrderId` / `orderKindFromId` / `extractOrderId` — TIX support already exists there. Keep the whitelist comment accurate (it's the SQL-injection safety argument).
- **Validate:** `npm run check` passes; grep shows webhook picks ticket target: `confirmTargetForOrder("AFROIN-TIX-xxxx…")` returns the ticket_orders target (verified via the Phase A curl test in Test Tasks).

### Task 3: Create tickets data layer
- **Action:** create
- **File:** `src/lib/tickets.ts`
- **Pattern:** `src/lib/orders.ts` (validation style, `clean()`, `CheckoutError`, snapshots, `db.batch`)
- **Details:**
  - `getVisibleEvents(db)`: events with `visible=1 AND event_date >= now` ordered by date, each with `sold` (COUNT of tickets) for sold-out badge.
  - `getEventBySlug(db, slug)`: single event + `sold` count (public detail; returns hidden/past events as `null`).
  - `createPendingTicketOrder(db, input)`: input `{ eventSlug, quantity, buyer: {name, email, phone?} }`. Validate: name required (≤100), email regex (reuse pattern from orders.ts), quantity integer 1–10. Load event by slug server-side; reject if missing, `visible=0`, or `event_date < now` ("El evento no está disponible"). Re-price server-side: `amount = event.price * quantity` (client sends NO price). Enforce `BOLD_MIN_AMOUNT` (import from `@/lib/orders`). **Quota check:** `SELECT COUNT(*) FROM tickets WHERE event_id=?` → reject if `sold + quantity > capacity` ("Entradas agotadas" / partial: "Solo quedan N entradas"). Insert `ticket_orders` row with `generateOrderId("ticket")`, `access_token = crypto.randomUUID()`, snapshots (`event_name = name_es`, `unit_price`). Return `{ id, orderId, amount, currency, quantity, eventName }`.
  - `issueTicketsForOrder(db, boldOrderId)`: **idempotent** side effect called after a confirmation flips the order to `completed`. Read the order; return early unless `status='completed'`. Guard: `SELECT COUNT(*) FROM tickets WHERE ticket_order_id=?` — if >0, return existing (webhook + browser confirm can race; the UNIQUE code + this guard make double-issuance harmless). Re-check capacity: if `sold + quantity > capacity`, STILL issue (payment approved) but `console.error` an oversell log line for manual follow-up. Generate `quantity` codes via `generateTicketCode()` (10 chars from `crypto.getRandomValues` mapped onto the Crockford base32 alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`), insert via `db.batch`.
  - `getTicketOrderByToken(db, token)`: order + event fields + tickets array (for the permanent link page).
  - `getTicketOrderByBoldId(db, boldOrderId)`: same shape, used by the confirm endpoint receipt.
  - `checkInTicket(db, code)`: normalize code (trim, uppercase, strip spaces/dashes). Look up ticket JOIN order JOIN event. Not found → `{result:"not_found"}`. Order not `completed` → `{result:"not_paid"}`. Already `checked_in` → `{result:"already", checkedInAt, attendee, eventName}`. Else `UPDATE tickets SET status='checked_in', checked_in_at=CURRENT_TIMESTAMP WHERE code=? AND status='valid'` and check `meta.changes > 0` (atomic guard against double-scan race) → `{result:"ok", attendee: buyer_name, eventName, ticketNumber}`.
- **Gotcha:** D1 lacks multi-statement transactions — the read-check-insert quota window is why oversell is possible (documented Domain Assumption). Keep `checkInTicket`'s UPDATE conditional on `status='valid'` — that `meta.changes` check IS the concurrency guard.
- **Validate:** `npm run check` passes (full behavior validated via Phase A curl matrix in Test Tasks).

### Task 4: Create ticket checkout endpoint
- **Action:** create
- **File:** `src/pages/api/tickets/checkout.ts`
- **Pattern:** `src/pages/api/store/checkout.ts` (copy structure: prerender=false, payload cap, JSON guard, keys check, signature, 201)
- **Details:** POST body `{ eventSlug, quantity, buyer: {name, email, phone?} }` (max 4KB). Call `createPendingTicketOrder`; map `CheckoutError` → its status. Sign with `generateIntegritySignature(orderId, String(amount), "COP", env.BOLD_SECRET_KEY)`. Return 201 `{ orderId, integritySignature, apiKey: env.BOLD_API_KEY, amount: String(amount), currency, quantity, eventName }`.
- **Gotcha:** `amount` must be returned as the exact string that was signed.
- **Validation:** required: `eventSlug` (string, must exist+visible+future), `quantity` (int 1–10), `buyer.name` (≤100), `buyer.email` (regex). Payload ≤4KB → 413. Unknown/hidden/past event → 400. Over capacity → 400 with remaining count.
- **Error UX:** JSON `{error}`; the purchase island renders it inline under the pay button (same as store checkout).
- **Validate:** curl matrix in Test Tasks (400 empty, 400 bad email, 400 sold-out, 201 happy path with `AFROIN-TIX-` id).

### Task 5: Create ticket confirm endpoint
- **Action:** create
- **File:** `src/pages/api/tickets/confirm.ts`
- **Pattern:** `src/pages/api/store/confirm.ts`
- **Details:** POST `{orderId}` (must start with `AFROIN-TIX-`, else 400). `confirmBoldOrder(db, env.BOLD_API_KEY, orderId, CONFIRM_TARGETS.ticket)` → then `issueTicketsForOrder(db, orderId)` → then `getTicketOrderByBoldId` and return `{ status, providerStatus, order: {id, event_name, quantity, amount, currency, access_token, paid_at, event fields for display}, tickets: [{code, status}] }`. Never return tickets array unless `status === 'completed'`.
- **Gotcha:** Issue tickets AFTER confirm regardless of `changed` (the webhook may have flipped the row first and `issueTicketsForOrder` is idempotent) — this closes the webhook-vs-browser race.
- **Validation:** `orderId` required string with `AFROIN-TIX-` prefix.
- **Error UX:** receipt island maps `pending|rejected|failed` to the existing phase-machine UI copy.
- **Validate:** curl with a fake TIX id returns `{status:"pending"|"rejected"…}` without 500; happy path verified in Phase B manual smoke.

### Task 6: Issue tickets from the webhook path
- **Action:** modify
- **File:** `src/pages/api/bold-webhook.ts`
- **Pattern:** existing handler (lines 41–56)
- **Details:** After `confirmBoldOrder(...)`, when `orderKindFromId(orderId) === "ticket"` and `result.donorStatus === "completed"`, call `issueTicketsForOrder(env.DB, orderId)` inside its own try/catch (log failure, still return 200 — Bold retries would re-run the idempotent issuance).
- **Gotcha:** Don't gate on `result.changed`: if the browser confirm flipped the row milliseconds earlier, `changed=false` but issuance may still be pending; the idempotent guard makes the extra call free.
- **Validate:** `npm run check`; simulated webhook POST with a paid local order issues rows in `tickets` exactly once even when called twice.

### — PHASE B: Public purchase & ticket pages —

### Task 7: Add localized routes and UI strings
- **Action:** modify
- **File:** `src/i18n/routes.ts` + `src/i18n/locales/es.json`, `en.json`, `fr.json`
- **Pattern:** existing `store`/`checkout`/`order` keys
- **Details:** routes: `events: "/eventos" | "/events" | "/evenements"`, `tickets: "/entradas" | "/tickets" | "/billets"`. Locale strings (namespaces `events.*`, `tix.*`): listing title/empty state, detail labels (date, venue, price, remaining, sold-out), purchase form (name/email/phone/quantity, pay button, processing, inline errors), receipt (success/pending/failed titles+texts mirroring `order.*`, "your tickets", "save this link" explainer, WhatsApp note), permanent page strings.
- **Gotcha:** Keys must exist in ALL THREE locale files — missing keys render as `undefined` in islands that receive a plain `t` record.
- **Validate:** `npm run check`; spot-check `/fr/evenements` renders French strings during Phase B smoke.

### Task 8: Public events listing (3 langs)
- **Action:** create
- **File:** `src/templates/EventosIndexTemplate.astro` + `src/pages/eventos/index.astro` + `src/pages/en/events/index.astro` + `src/pages/fr/evenements/index.astro`
- **Pattern:** `src/templates/TiendaIndexTemplate.astro` + `src/pages/tienda/index.astro` (SSR, `prerender=false`, D1 via `Astro.locals.runtime.env.DB`)
- **Details:** Template accepts `lang`, calls `getVisibleEvents(db)`, renders cards: image (`/media/<image_r2_key>` when set, `ImagePlaceholder`-style fallback otherwise), localized name (fallback `name_es`), date formatted per locale, venue/city, price (`formatPrice` from `@/lib/cart`), sold-out badge when `sold >= capacity`. Card links to localized detail path.
- **Gotcha:** SSR pages must NOT use astro:assets `<Image>` (no Sharp at runtime on Workers — this exact regression happened before; use plain `<img>`).
- **Validate:** `astro dev` → GET `/eventos`, `/en/events`, `/fr/evenements` return 200 with seeded event visible.

### Task 9: Public event detail + purchase island (3 langs)
- **Action:** create
- **File:** `src/templates/EventoSlugTemplate.astro` + `src/pages/eventos/[slug].astro` + `src/pages/en/events/[slug].astro` + `src/pages/fr/evenements/[slug].astro` + `src/components/TicketCheckoutForm.tsx`
- **Pattern:** `src/templates/TiendaSlugTemplate.astro` (slug SSR + redirect-to-index when missing) + `src/components/CheckoutForm.tsx` (Bold SDK flow — copy `loadBoldSDK`, config build, sessionStorage, HTTPS-only `redirectionUrl`)
- **Details:** Page: `getEventBySlug` → 302 to localized events index if null. Renders hero (name/date/venue/description localized) + `<TicketCheckoutForm client:load lang={...} eventSlug={...} price={...} remaining={...} successPath={localized tickets path} t={...} />`. Island: fields name/email/phone + quantity stepper (1–10, capped at `remaining`), live total `price × qty`, on submit POST `/api/tickets/checkout`, store `sessionStorage.setItem("tix_order_id", data.orderId)`, open `BoldCheckout` with `description: \`Entradas AFRO IN — ${eventName}\`` and `redirectionUrl = origin + successPath` (HTTPS only). If `remaining <= 0` render sold-out state instead of the form.
- **Gotcha:** `remaining` from SSR props is a snapshot — the API re-checks; island must surface the API's sold-out error gracefully. Use a distinct sessionStorage key (`tix_order_id`), NOT `store_order_id`.
- **Validation:** (island-side, pre-flight) name non-empty, email regex, qty 1–min(10, remaining) — mirrors server rules.
- **Error UX:** inline `.ck-error`-style paragraph above the pay button with the API `error` message.
- **Validate:** `astro dev` → detail page 200; submitting with test data returns 201 and opens the Bold modal (manual smoke; Bold sandbox keys in local `.env`).

### Task 10: Receipt + permanent ticket pages with QR (3 langs)
- **Action:** create
- **File:** `src/components/TicketReceipt.tsx` + `src/components/TicketQR.tsx` + `src/pages/entradas/index.astro` + `[token].astro` (+ `en/tickets/`, `fr/billets/` equivalents) + template `src/templates/EntradasTemplate.astro`
- **Pattern:** `src/components/OrderReceipt.tsx` (phase machine, param → sessionStorage fallback) + `src/pages/pedido.astro`
- **Details:**
  - `/entradas` (index, SSR shell + island): island reads `bold-order-id` param → `tix_order_id` sessionStorage fallback → POST `/api/tickets/confirm`. On `completed`: render event summary + one card per ticket (QR + monospace code) + prominent permanent-link block (`{origin}{ticketsPath}/{access_token}`) with copy button and "guarda este enlace / manual WhatsApp" note. On `pending|failed`: same UX copy pattern as OrderReceipt.
  - `/entradas/[token]` (SSR): `getTicketOrderByToken` server-side; unknown token → 302 to localized home; `pending` order → render the confirm island (retry path); `completed` → render tickets server-side data through the same ticket-cards component (QR generated client-side in `TicketQR`).
  - `TicketQR.tsx`: renders the ticket `code` as QR via the `qrcode` npm package (`toDataURL` in an effect → `<img>`), code text below for manual entry. Checked-in tickets show a subtle "usada" overlay.
- **Gotcha:** NEW DEPENDENCY `qrcode` (+ `@types/qrcode`) — **ask the user before installing** (global rule). QR encodes ONLY the raw code (not a URL) so the scanner POSTs it directly. Tokens are bearer secrets: permanent pages must send `X-Robots-Tag`/`noindex` meta and be excluded from the sitemap.
- **Validate:** After a completed local order: `/entradas?bold-order-id=<id>` shows N QRs; `/entradas/<token>` shows the same tickets after clearing sessionStorage; bogus token redirects.

### — PHASE C: Admin (events CRUD + sales) —

### Task 11: Admin events API
- **Action:** create
- **File:** `src/pages/api/admin/events/index.ts` (GET list + POST create), `src/pages/api/admin/events/[id].ts` (PUT + DELETE), `src/pages/api/admin/events/upload.ts` (image → R2)
- **Pattern:** `src/pages/api/admin/products/{index.ts,[id].ts,upload.ts}`
- **Details:** Every handler starts with `if (!(await requireAdmin(ctx))) return adminUnauthorized();`. CRUD over `events` with server-side validation. Upload: same R2 flow as products but keys `events/<slug>/main.<ext>`, store returned key in `image_r2_key`. GET list includes `sold` + `checked_in` counts per event (single GROUP BY query — no N+1). DELETE: reject with 409 when the event has tickets (paid history must not cascade away); suggest hiding instead.
- **Gotcha:** Middleware does NOT protect `/api/admin/*` — the explicit `requireAdmin` call is the only guard.
- **Validation:** required: `slug` (kebab, unique), `name_es`, `event_date` (ISO datetime), `price` (int ≥ `BOLD_MIN_AMOUNT`), `capacity` (int ≥ 1). Optional: en/fr fields, venue, city, description, image. Duplicate slug → 400 "slug already exists".
- **Error UX:** JSON `{error}`; EventForm shows it in the sticky bar (same as ProductForm).
- **Validate:** curl: unauthenticated → 401; authed POST → 201; dup slug → 400; PUT updates; DELETE with sold tickets → 409.

### Task 12: Admin events dashboard + form
- **Action:** create
- **File:** `src/components/EventsDashboard.tsx`, `src/components/admin/EventForm.tsx`, `src/pages/admin/eventos.astro`, `src/pages/admin/eventos/nuevo.astro`, `src/pages/admin/eventos/[id].astro`
- **Pattern:** `src/components/ProductsDashboard.tsx` + `src/components/admin/ProductForm.tsx` + `src/pages/admin/productos{,.astro,/nuevo.astro,/[id].astro}`
- **Details:** Dashboard: AdminGrid columns — name, date, venue/city, price, `sold/capacity` (progress-style cell), checked-in count, visible switch, actions (edit). Form: localized name/description with the existing 🇪🇸🇬🇧🇫🇷 language switcher pattern, venue, city, datetime-local input for `event_date`, price, capacity, single image upload, visible switch, sticky save bar.
- **Gotcha:** Keep the full-height flex chain (`flex h-full min-h-0 flex-col`, grid `flex-1`) or the AG Grid collapses — copy the wrapper classes from `pedidos.astro`/ProductsDashboard verbatim.
- **Validate:** `astro dev`: `/admin/eventos` 200 with grid; create → edit → hide event round-trips.
- **Time-box:** capacity progress cell: 20 min max — fall back to plain `12/100` text if a custom renderer fights AG Grid theming.

### Task 13: Admin ticket sales dashboard
- **Action:** create
- **File:** `src/components/TicketOrdersDashboard.tsx` + `src/pages/admin/entradas.astro` + `src/pages/api/admin/tickets/index.ts`
- **Pattern:** `src/components/OrdersDashboard.tsx` + `src/pages/admin/pedidos.astro` + `src/pages/api/admin/orders/index.ts`
- **Details:** API (requireAdmin): GET ticket orders (JOIN event name; filter by `event_id` query param optional) + per-order tickets with check-in status. Dashboard: AdminGrid — order id short, event, buyer name/email/phone, qty, amount, status badge (pending/completed/rejected), checked-in `n/qty`, created_at. Row click → detail dialog listing each ticket code + status + permanent link (copyable) so staff can resend it via WhatsApp manually.
- **Gotcha:** The permanent link in the dialog is the manual "delivery" mechanism of v1 — make it one-click copy.
- **Validation:** N/A (read-only GET; requireAdmin guard).
- **Error UX:** grid empty-state text on fetch failure (same as OrdersDashboard).
- **Validate:** `/admin/entradas` 200; completed local order appears with its tickets in the dialog.

### Task 14: Sidebar navigation
- **Action:** modify
- **File:** `src/layouts/AdminLayout.astro`
- **Pattern:** `navItems` array (lines 26–31)
- **Details:** Add `{ href: "/admin/eventos", label: "Eventos", icon: CalendarDays }`, `{ href: "/admin/entradas", label: "Entradas", icon: Ticket }`, `{ href: "/admin/checkin", label: "Check-in", icon: ScanLine }` (icons from `lucide-astro`). Desktop and mobile navs both iterate this array — one edit covers both.
- **Gotcha:** Active-state matching: `/admin/entradas` must not mark `/admin/eventos` active (check how current matching handles prefixes; `pedidos`/`productos` coexist fine so the pattern already copes).
- **Validate:** All three items render + navigate on desktop and mobile menus.

### — PHASE D: Check-in scanner —

### Task 15: Check-in API + scanner page
- **Action:** create
- **File:** `src/pages/api/admin/checkin.ts` + `src/components/CheckinScanner.tsx` + `src/pages/admin/checkin.astro`
- **Pattern:** admin endpoint guard pattern (`requireAdmin` + `adminUnauthorized`); page shell like `pedidos.astro`
- **Details:**
  - API: POST `{code}` → `checkInTicket(db, code)` → 200 with `{result, attendee, eventName, checkedInAt?}` (result ∈ `ok|already|not_found|not_paid`).
  - Island (mobile-first, `client:only="react"`): camera viewfinder via `getUserMedia` (`facingMode: "environment"`). Detection: native `BarcodeDetector` when `"BarcodeDetector" in window` with `qr_code` in `getSupportedFormats()`; otherwise the `barcode-detector` ponyfill (zxing-wasm) — same API surface, so ONE detection loop (rAF/interval ~200ms). On detection: pause loop, POST, render verdict card — green ✓ (ok: attendee + event), amber ⚠ (already + time), red ✕ (not_found/not_paid) — with a big "Escanear siguiente" button that resumes. Debounce identical consecutive codes for 3s. Session counter "válidas hoy: N". ALWAYS render a manual `<input>` + submit below the camera (works with no camera permission at all).
  - Page: minimal chrome, full-height.
- **Gotcha:** NEW DEPENDENCY `barcode-detector` — **ask the user before installing**. Camera requires HTTPS or localhost (`astro dev` on LAN IP will NOT get camera — test via localhost or the deployed URL on phones). iOS Safari needs `playsinline` on the `<video>`. `client:only` skips SSR so `window` guards are safe.
- **Validation:** `code` required non-empty string ≤ 20 chars after normalization.
- **Error UX:** verdict card states above; network failure → red card "Error de red — reintenta" with the code preserved in the manual input.
- **Validate:** Manual matrix — desktop Chrome (native detector), iPhone Safari (ponyfill), Android Chrome; valid code → ✓ once then ⚠; garbage code → ✕; manual entry path works with camera denied.
- **Time-box:** 60 min max on the camera/ponyfill loop. Fallback: ship manual-code-entry-only (keyboard/HID scanners still work) and file the camera as follow-up.

## Interaction Matrix

| Action | Context | Expected Behavior |
|--------|---------|-------------------|
| Set quantity above remaining | Purchase form, 3 seats left | Stepper caps at 3; if API still rejects (race), inline "Solo quedan N entradas" |
| Submit with invalid email | Purchase form | Inline error under field; no API call |
| Complete Bold payment | Bold modal | Redirect to localized `/entradas?bold-order-id=…` → success + QRs + permanent link |
| Abandon Bold modal, reopen `/entradas` | sessionStorage has `tix_order_id` | Confirm returns `pending` → pending copy + link to retry |
| Open permanent link, order completed | `/entradas/[token]` | Tickets + QRs render (server data), no confirm round-trip |
| Open permanent link, unknown token | `/entradas/[token]` | 302 to localized home |
| Scan valid code | Scanner, camera active | Green card with attendee + event; counter +1; loop paused until "next" |
| Scan same code again | Scanner | Amber "already checked in at HH:MM"; no state change |
| Scan foreign/garbage QR | Scanner | Red "not found"; resume on "next" |
| Type code manually (lowercase, with dashes) | Camera denied / broken | Normalized server-side; same verdict cards |
| Buy on sold-out event via stale tab | Detail page opened earlier | Checkout API 400 sold-out; inline error |
| Admin deletes event with sales | `/admin/eventos` | 409 + message suggesting hiding it instead |
| Toggle event `visible` off | Admin | Gone from public listing; existing tickets still check in |

## Test Tasks

> No test framework exists in this project (no test script/deps in `package.json`; validated 2026-07-02). Per project convention (store checkout shipped the same way), validation is `npm run check` + a scripted curl/browser matrix against `astro dev`. Adding vitest is out of scope.

- **T1 (after Phase A):** curl matrix against `astro dev` with a seeded local event: checkout 201 happy path (id starts `AFROIN-TIX-`), 400 bad email, 400 unknown slug, 400 quantity 0/11, 400 sold-out (seed capacity 1, buy 2), 413 oversized payload, confirm with fake TIX id → non-500 pending/rejected. Simulate webhook double-delivery → tickets issued exactly once (`SELECT COUNT(*) FROM tickets WHERE ticket_order_id=…` == quantity).
- **T2 (after Phase B):** browser smoke es/en/fr: listing, detail, purchase (Bold sandbox), receipt QRs, permanent link cold-load, bogus token redirect, sold-out rendering.
- **T3 (after Phase C):** admin: 401 unauthenticated curls on every new `/api/admin/*` route; CRUD round-trip; dup slug 400; DELETE-with-sales 409; grids render; **regression:** `/admin/pedidos`, `/admin/productos`, `/admin/donadores` still load and their grids populate (shared AdminGrid/nav touched).
- **T4 (after Phase D):** device matrix (Android Chrome, iPhone Safari, desktop) per Task 15's Validate; camera-denied manual path.
- **T5 (final):** `npm run check` (build + tsc + deploy dry-run) green; **regression:** store checkout end-to-end still works (shared `bold.ts` was modified) and a donation confirm still routes to `donors` (webhook with legacy `AFROIN-<uuid>` id).

## Phase Boundaries

Commit (Conventional Commits, ask user first per global rules) at each boundary:

1. **Phase A** → `feat(tickets): data layer, Bold ticket target and checkout/confirm APIs` — after T1 passes.
2. **Phase B** → `feat(tickets): public event pages, purchase flow and QR ticket pages` — after T2 passes.
3. **Phase C** → `feat(admin): events CRUD and ticket sales dashboards` — after T3 passes.
4. **Phase D** → `feat(admin): QR check-in scanner` — after T4/T5 pass.

## Validation Checklist

Run in this order — do not proceed if a level fails:

- [ ] **Level 1 — Lint & Format:** N/A — project has no lint script/config (verified in `package.json`); keep style consistent with neighboring files.
- [ ] **Level 2 — Type Check:** `npm run check` (runs `astro build && tsc && wrangler deploy --dry-run`)
- [ ] **Level 2.5 — Code Review:** Run the `code-review` skill on changed files
- [ ] **Level 3 — Unit Tests:** N/A — no test framework (see Test Tasks justification); run T1 curl matrix instead
- [ ] **Level 4 — Integration Tests:** T1–T4 matrices against `astro dev` (NOT `wrangler dev` — known `MessageChannel is not defined` crash in local worker runtime)
- [ ] **Level 5 — Human Review:** T5 + user checks purchase + scanner on a real phone

## Acceptance Criteria

- [ ] Admin can create/edit/hide an event with localized fields, image, price, capacity.
- [ ] Public `/eventos`, `/en/events`, `/fr/evenements` list visible future events; detail pages sell tickets via Bold.
- [ ] A completed payment issues exactly `quantity` tickets with unique codes; double webhook/browser confirmation never duplicates them.
- [ ] Success page and permanent token link both render every ticket with QR + readable code, without email.
- [ ] Sold-out events refuse checkout server-side (and render sold-out state).
- [ ] Scanner (or manual entry) marks a ticket checked-in exactly once; duplicate scans warn with the original timestamp.
- [ ] Legacy flows unaffected: donation and store-order confirmations still route to their tables (T5 regression).
- [ ] `npm run check` passes; migrations applied LOCAL during dev, REMOTE at deploy.

## Confidence Score: 8/10

- **Strengths:** The Bold pipeline was explicitly generalized for tickets in Phase 2 (id infix, webhook routing, whitelisted confirm targets already anticipate `TIX`); every layer (SSR public page, admin CRUD+grid, Bold island, R2 upload, requireAdmin) has a proven in-repo pattern to copy; schema mirrors a working contract.
- **Uncertainties:** (1) Camera scanning across iOS Safari is the only genuinely new terrain — mitigated by the `barcode-detector` ponyfill and a manual-entry fallback that ships regardless (Task 15 time-box). (2) Two new npm deps need user approval. (3) Domain Assumptions were auto-adopted (user AFK) and could shift scope — confirm before executing. (4) Oversell window under concurrent purchases is accepted, not solved.
- **Mitigations:** Time-boxed scanner task with degradation path; idempotent issuance closes webhook/browser races; per-phase commits isolate risk; assumptions listed for explicit confirmation.

## Notes for Executing Agent

- **Confirm the Domain Assumptions bullets with the user before Phase A** — they were adopted as recommended defaults while the user was away.
- **New dependencies (ask before installing, global rule):** `qrcode` + `@types/qrcode` (QR rendering, Phase B) and `barcode-detector` (scanner ponyfill, Phase D). Both are needed at their phase start, not before.
- Validate locally with `astro dev` (port free of 4321? use `--port`), **never** `wrangler dev` (known `MessageChannel is not defined` crash with react-dom/server in the local runtime — does not affect production).
- Migrations: `npx wrangler d1 execute afroin --local --file=migrations/0008_create_ticketing.sql` during dev; `--remote` only at deploy time, together with setting any pending secrets. Seed a test event locally via a small SQL insert for the curl matrices.
- Bold sandbox keys live in `.env` (`BOLD_API_KEY`, `BOLD_SECRET_KEY`); an env-protect hook blocks agents from writing `.env` — if keys are missing, ask the user.
- Outstanding pre-deploy item from Phase 2 (unrelated but pending): user must set `ASTRO_KEY` (server-island prop encryption) via `npx astro create-key` → `.env`.
- Token pages are bearer-secret URLs: add `noindex` and keep them out of the sitemap (check `@astrojs/sitemap` config in `astro.config.mjs` for an exclude hook).
- Code in English; UI copy in the three locale files; admin UI copy in Spanish (existing convention: sidebar labels are Spanish).

> **UI Styling Note:** UI styling specifications (colors, sizes, variants, labels, spacing) are `[provisional]` proposals — expect them to change once the user sees the implementation. Implement as specified but do not over-invest in pixel-perfect adherence; plan for iteration.
>
> **Expected UX iterations: 4** — new public section (cards/detail/receipt), ticket cards with QR, two admin dashboards and a scanner UI; manual smoke will surface visual adjustments. Iterations within this budget are not scope creep.
