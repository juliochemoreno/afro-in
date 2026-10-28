# Plan: D1 — Finish event ticketing (bring production's code into git, correct and safe)

## Overview

Production (afroin.org) runs a manual deploy of 2026-10-06 built from the ticketing work that now lives on `feature/event-ticketing` (phases A–D, 7ac05bd..ecc0833) plus the rescued Oct-6 extensions (5516faa: admin accounts, courtesy tickets, event location). D1 lands that code in `dev` without changing what buyers see, fixes the two known security findings (default superadmin in `0010`, forgeable admin sessions), fixes the money-path defects found while planning, applies 0008–0010 to the staging D1 and proves the flow on the branch's Worker Preview.

## Requirements Summary

- One branch (`claude/d1-ticketing-3fa7a0`, already merged with `origin/dev` in 2eb681a), one PR to `dev`.
- `migrations/0010_create_admins.sql` enters git WITHOUT any credential, and stays safe to run where it was already applied (production probably has it).
- `src/lib/adminAuth.ts` signs sessions with a dedicated secret (`ADMIN_SESSION_SECRET`) and fails closed when it is missing.
- No silent change to what buyers see (event pages, purchase, receipts, ticket pages, QR codes). Every buyer-visible change is a Domain Assumption Julio confirms.
- Money-path correctness: tickets are issued exactly `quantity` times per paid order, never zero after a crash between "claim" and "insert".
- Staging D1: 0008, 0009, 0010 applied with `wrangler.preview-migrations.jsonc`; fake catalog rows in `seeds/preview.sql`.
- Validation: `npm run check`, curl matrix against `astro dev`, Level 5 on the branch Preview, code review per phase, one fresh-context branch review before the PR.
- Workflow classification: purchase and check-in are **sequential user-driven** (one submit / one scan → one request). Webhook + browser confirm are **async data-arrival** racing on the same order (idempotency required, already designed).

## Out of Scope

- `src/middleware.ts` and `public/_headers` (worker D6 edits them in parallel). Verified the middleware only imports `ADMIN_COOKIE` and `isValidAdminSession` (`grep -rn "adminAuth" src` → `src/middleware.ts:2`), so keeping those two exports with the same signature means no middleware edit.
- Real verification of Bold's `x-bold-signature` (needs observing a real test webhook first; see Task 6 and Likely Follow-ups).
- Login rate limiting / lockout.
- Automated test framework (new dependency → Julio's OK; work list "Later").
- D2 (programación buttons), D3 (CSV export), ticket tiers, email delivery.
- Production migrations and production secrets: Julio applies/sets them (see "What Julio does").

## Likely Follow-ups

- Verify `x-bold-signature` (Base64(raw body) → HMAC-SHA256 hex; key = Botón de pagos secret in production, empty string in test mode per developers.bold.co/webhook) once a real test webhook has been observed on the `dev` Preview (O6).
- Login rate limiting (per IP / per account) on `/api/admin-login`.
- D2, D3 (already in the work list).
- Check-in scoped to one event (scanner chooses the event; a ticket for another event is rejected).
- Automated tests for `src/lib/tickets.ts` and `src/lib/adminAuth.ts`.

## Git Strategy

- **Base branch:** `dev` (PR target). Integration branch is `dev`; only Julio releases `dev` → `main`.
- **Feature branch:** `claude/d1-ticketing-3fa7a0` (the session's worktree branch; it starts at `feature/event-ticketing` 5516faa and already has `origin/dev` merged with `--no-ff`, no rebase).
- Never `git stash pop` (stash is shared). Read 0010's original with `git show 32c1cf5^3:migrations/0010_create_admins.sql`.

## Context References

Verified 2026-10-27 on this branch (after merging `origin/dev` 8b97561):

- `src/lib/adminAuth.ts:69-71` — `getHmacSecret` = `ADMIN_PASSWORD || BOLD_SECRET_KEY || "afroin-secret-auth-seed"` (constant is in pushed history on `feature/event-ticketing`). `:102-121` legacy token = HMAC(ADMIN_PASSWORD, `afroin-admin-session:<user>`), never expires. `:124-186` `verifyAdminSession`: trusts `{id,email,role}` from the signed payload, never re-reads `admins` (a deleted/deactivated/demoted admin keeps access up to 8 h); signature compared with `===`. Env-fallback admin and legacy token both get `id: 1`, colliding with D1 admin id 1 (`isSelf` in `admins/[id].ts:23`, self-delete guard `:118`).
- `src/pages/api/admin-login.ts:39-75` — D1 `admins` lookup (PBKDF2, `verifyPassword` constant-time), then env fallback `ADMIN_USER`/`ADMIN_PASSWORD` (plain `===`), role `superadmin`, `id: 1`.
- Every importer of `adminAuth` (`grep -rn "adminAuth" src`): `src/middleware.ts`, `src/pages/admin/login.astro` (`ADMIN_COOKIE`, `isValidAdminSession`), `src/pages/api/admin-logout.ts` (`ADMIN_COOKIE`), `src/pages/api/admin-login.ts`, and 17 `/api/admin/*` routes using `requireAdmin` + `adminUnauthorized` (+ `hashPassword` in `admins/*`). Each `/api/admin/*` file calls `requireAdmin` first (rule 2) — verified for events, tickets, courtesy, checkin, admins.
- `git show 32c1cf5^3:migrations/0010_create_admins.sql` — `CREATE TABLE IF NOT EXISTS admins (id, email UNIQUE, name, password_hash, salt, role DEFAULT 'admin', is_active DEFAULT 1, created_at, updated_at)`, `CREATE INDEX IF NOT EXISTS idx_admins_email`, then `INSERT OR IGNORE` of `admin@afroin.com` superadmin with a fixed hash/salt and the plaintext password in a comment. `git log --all -S "<that password>"` → only the stash commit 3c38c22 (never pushed). O4 says Julio already handled the default superadmin in production.
- `migrations/0009_add_event_location_fields.sql` — two `ALTER TABLE events ADD COLUMN` (not idempotent in SQLite: re-running fails with "duplicate column"). Production must never re-run it if already applied.
- `migrations/0008_create_ticketing.sql` — `ticket_orders` has the Bold contract columns + `tickets_issued INTEGER NOT NULL DEFAULT 0`; `tickets.code UNIQUE`.
- Staging state: `npx wrangler d1 migrations list PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc --env-file=<main>/.env` → "Migrations to be applied: 0008_create_ticketing.sql, 0009_add_event_location_fields.sql" (0010 not in the tree yet).
- `src/lib/tickets.ts:388-448` `issueTicketsForOrder` — claims with `UPDATE … SET tickets_issued=1 WHERE … tickets_issued=0`, THEN inserts the tickets in a separate `db.batch`. If the batch fails (or the Worker dies) after the claim, the order stays `tickets_issued=1` with 0 tickets and every later call returns the (empty) existing codes: a paid buyer never gets tickets. Same two-step gap in `createPendingTicketOrder` free path (`:200-243`) and `createCourtesyTicketOrder` (`:315-351`): order row inserted, tickets inserted later.
- D1 `batch()` runs its statements as one SQL transaction (rolls back entirely if one fails) — Cloudflare D1 docs, "Batch statements". Basis for Task 5.
- `src/lib/tickets.ts:66-68,84,108,167` — "past event" uses `event_date < new Date().toISOString()`. `event_date` is a wall-clock string without zone (`EventForm.tsx:182` builds `${date}T${time || "20:00"}`), `nowIso()` is UTC with `Z`. String comparison closes sales and hides the event when UTC reaches the event's local wall time, i.e. 5 h before start in Colombia (UTC-5). Julio approved fixing it (Task 5b). Display is unaffected: the Worker runs in UTC, so `new Date(event_date).toLocale…` prints the wall-clock time as typed (`EventoSlugTemplate.astro:19`, `EntradasTemplate.astro:57`).
- `src/pages/api/tickets/checkout.ts:31-55` — creates the `ticket_orders` row BEFORE checking Bold keys (5516faa moved the check below to let free events skip it); with missing keys a pending row is left behind and the buyer gets 500.
- `src/pages/api/tickets/confirm.ts:19,43` — `request.json()` parse error → 500; reported `status` comes only from the Bold voucher query. If the voucher call fails (`fetchBoldVoucher` returns null → `NO_TRANSACTION_FOUND` → `pending`, `bold.ts:138-140,203-208`) the buyer sees "pending" and no tickets even when the webhook already completed the order.
- `src/pages/api/bold-webhook.ts:24-34` (added in phase A) — reads header `bold-signature` and HMACs the raw body. Bold's documented header is `x-bold-signature`, HMAC-SHA256 hex over the **Base64-encoded** body, key = secret key in production and the **empty string in test mode** (https://www.developers.bold.co/webhook, fetched 2026-10-27). Bold never sends `bold-signature`, so in production this block is a no-op (always the "missing signature, proceeding" branch); the real guard is the voucher re-query (`confirmBoldOrder`). Bold sandbox: payment-button transactions do NOT send webhooks unless "Probar el webhook" is used at the end of the purchase (same page).
- `src/lib/bold.ts:178-187` — `CONFIRM_TARGETS` whitelist includes `ticket_orders`; `confirmTargetForOrder` routes by prefix; `extractOrderId` matches `TIX-`. Store/donation routing unchanged except the ticket entry (T5 regression).
- `src/components/TicketQR.tsx:7-8` — loads `https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js` at runtime, no SRI. `src/components/CheckinScanner.tsx:32` — dynamic `import("https://esm.sh/barcode-detector@2/pure")`: floating major range, runs on an admin page (could call admin APIs with the admin's cookie).
- `wrangler.json` — top-level `vars.PUBLIC_GOOGLE_MAPS_API_KEY` (added by 5516faa); `previews` has only D1/R2. Top-level vars do not reach Previews. The key is read at runtime by `src/pages/admin/eventos/{nuevo,[id]}.astro:8-9,19-20`. Spike: `node -e` over `node_modules/wrangler/config-schema.json` → `PreviewsConfig` properties include `vars` and `secrets` (wrangler 4.149.0).
- `.dev.vars.example` — documents `ADMIN_USER`/`ADMIN_PASSWORD`/Bold keys only. `.dev.vars*` is gitignored (`.gitignore:198`); the tracked example stays.
- `.agents/hopla-active-plan.json` is NOT gitignored (`git check-ignore` → no match): do not write the pointer.
- Bold minimum 1,000 COP: `BOLD_MIN_AMOUNT` in `src/lib/orders.ts`; `eventAdmin.ts:41-42` enforces `price = 0 or ≥ 1000`.

## Domain Assumptions

Julio answered the open questions on 2026-10-27 (marked "Julio"); the other bullets are confirmed by approving this plan.

- **First superadmin (Julio, 2026-10-27):** 0010 creates no account. The env login (`ADMIN_USER`/`ADMIN_PASSWORD` secrets) stays as a superadmin "break-glass" account (`id: 0`); Julio uses it to create the real D1 admins in `/admin/administradores`.
- **Migrations in production (O4, verified 2026-10-27 with Julio's OK, one read-only schema query):** production already has every object of 0008 (`events`, `ticket_orders` incl. `tickets_issued`, `tickets`, their 7 indexes), 0009 (`events.department`, `events.country`) and 0010 (`admins` with the same 9 columns, `idx_admins_email`). So the D1 release needs NO production migration; the rewritten 0010 is schema-identical. Production also has a `d1_migrations` table (contradicts `orchestrator.md` "no tracking table"); its rows were not read — report this to the orchestrator, do not act on it.
- **Ticket sales close at the real start time (Julio, 2026-10-27):** an event stays listed and on sale until its start time in Colombia (`America/Bogota`, fixed UTC-5, no DST). Buyer-visible change, approved.
- **Admin password minimum: 10 characters (Julio, 2026-10-27)** for new or changed passwords; existing passwords keep working.
- Rotating to `ADMIN_SESSION_SECRET` logs out every admin once (old cookies were signed with `ADMIN_PASSWORD`). Old "legacy" cookies (pre-Oct format) stop being accepted; they are at most 8 h old in any browser, so nobody valid is affected — confirm.
- Admin sessions are re-checked against D1 on each admin request: deactivating, deleting or demoting an admin takes effect immediately (today: up to 8 h later) — confirm.
- Free events (price 0) keep issuing tickets without payment, straight to the ticket page (production behavior) — confirm.
- Check-in accepts any paid ticket of any event (no per-event scoping in v1) — confirm.
- Courtesy tickets (admin) may be issued for hidden or past events and count against capacity — confirm.

## Requirements Delta

### ADDED Requirements
- REQ-ADMIN-001: Admin accounts in D1
  - Scenario: create — Given a superadmin session, When they create an admin with email, name, password (≥ min length) and role, Then that admin can log in at `/admin/login`.
  - Scenario: revoke — Given an admin with an open session, When a superadmin deactivates, deletes or demotes them, Then their next admin request is refused or runs with the new role.
- REQ-ADMIN-002: Session secret
  - Scenario: missing secret — Given `ADMIN_SESSION_SECRET` is not set, When anyone logs in or presents a cookie, Then login answers 500 "not configured" and no admin page or `/api/admin/*` route accepts the cookie.
- REQ-TIX-006: Courtesy tickets
  - Scenario: issue — Given an admin, When they issue N courtesy tickets for an event with capacity left, Then one completed order (amount 0) and exactly N tickets exist, or none at all if anything fails.

### MODIFIED Requirements
- REQ-TIX-002: Public ticket purchase (full replacement body)
  - A visitor buys 1–10 tickets of one visible, not-yet-closed event with capacity left. Paid events go through Bold; free events (price 0) complete immediately. The server re-prices from D1.
  - Scenario: buy — Given a visible open event with capacity, When the visitor pays with Bold, Then the `ticket_orders` row goes `pending → completed` and exactly `quantity` tickets with unique codes exist, whether the webhook, the browser confirm, or both arrive.
  - Scenario: crash — Given ticket issuance fails midway, When the confirm or webhook runs again, Then the tickets are issued (never "claimed with zero tickets").
  - Scenario: sales cutoff — Given an event starting at 20:00 Colombia time, When it is 19:59 in Bogotá, Then it is listed and sells; at 20:00 it is gone from `/eventos` and checkout answers 400.
  - Scenario: provider down — Given the order is already completed in D1, When the voucher query fails, Then the receipt still shows the tickets.

## Implementation Tasks

> Phased. Each phase ends with Level 2 (`npm run check`), a code review of that phase's files (`code-review` skill, strongest model), then a commit (standing approval: work-branch commits). Do not start a phase before the previous one is committed.

### — PHASE 1: Admin security —

### Task 1: Rewrite 0010 without credentials
- **Action:** create
- **File:** `migrations/0010_create_admins.sql`
- **Pattern:** original in `git show 32c1cf5^3:migrations/0010_create_admins.sql` (schema only)
- **Details:** Keep the `CREATE TABLE IF NOT EXISTS admins (...)` and `CREATE INDEX IF NOT EXISTS idx_admins_email` byte-for-byte compatible with the original columns/defaults (production probably applied the original). Drop the `INSERT` and the credential comment. Add a header comment: no account is seeded; how the first superadmin is created (per Julio's answer) — no password, hash or salt anywhere.
- **Gotcha:** Must be safe to run on a database that already has the table and the default row (all statements `IF NOT EXISTS`, no `INSERT`, no `DROP`/`DELETE`). Do not delete the default row from production in a migration — that is Julio's call (O4 says he handled it).
- **Validate:** `grep -niE "insert|password|hash|salt" migrations/0010_create_admins.sql` → only the column definitions `password_hash`/`salt`; `sqlite3 :memory: < migrations/0010_create_admins.sql && sqlite3` run twice on the same file DB succeeds.

### Task 2: Dedicated session secret, fail closed, revocable sessions
- **Action:** modify
- **File:** `src/lib/adminAuth.ts`
- **Pattern:** existing Web Crypto helpers in the same file
- **Details:**
  1. `getSessionSecret(env): string | null` → `env.ADMIN_SESSION_SECRET` when it is a string of ≥ 32 chars, else `null`. No fallback to `ADMIN_PASSWORD`, `BOLD_SECRET_KEY` or a constant.
  2. `createAdminSessionToken` throws (or returns null) when there is no secret; payload `{ id, email, role, ts }` where the env break-glass admin uses `id: 0`.
  3. `verifyAdminSession(env, cookie)`: no secret → `null`. Verify with `crypto.subtle.verify("HMAC", …)` (constant time) over the base64 payload; parse; reject `ts` in the future or older than `ADMIN_SESSION_MAX_AGE`. Then: `id === 0` → valid only while `env.ADMIN_PASSWORD` is set (env admin, role `superadmin`, name "Administrador (Env)"); `id > 0` → `SELECT id, email, name, role, is_active FROM admins WHERE id = ?` and require `is_active = 1`; return the DB row (DB role, not the token's). Any DB error → `null` (fail closed).
  4. Remove the legacy path (`getAdminSessionToken` and the legacy branch). Keep exports `ADMIN_COOKIE`, `ADMIN_SESSION_MAX_AGE`, `AdminUser`, `hashPassword`, `verifyPassword`, `isValidAdminSession(env, cookie)`, `requireAdmin(ctx)`, `adminUnauthorized()` with unchanged signatures (middleware and login.astro import them).
  5. Export `MIN_ADMIN_PASSWORD_LENGTH = 10` (Julio).
- **Gotcha:** `middleware.ts` calls `isValidAdminSession(env, cookie)` for every `/admin` page — it now does one D1 read; keep it a single indexed lookup by primary key. `btoa` of the JSON payload must not throw on non-ASCII names: only `id/email/role/ts` go in the payload. PBKDF2 stays at 100,000 iterations (Workers' maximum).
- **Validate:** `npx tsc --noEmit` clean for the file; curl matrix rows A1–A8 (Test Tasks).

### Task 3: Login uses the new session rules
- **Action:** modify
- **File:** `src/pages/api/admin-login.ts`
- **Pattern:** current file
- **Details:** Before anything else: no valid `ADMIN_SESSION_SECRET` → `console.error` + 500 `{ ok:false, error:"not_configured" }`. D1 lookup unchanged. Env fallback: compare user and password in constant time (HMAC both sides with a per-request random key, or compare SHA-256 digests with `timingSafeEqual`-style loop), `id: 0`. Remove the `getAdminSessionToken` import.
- **Gotcha:** Keep the response shapes (`{ok:true,user}` / `{ok:false,error:"invalid"}` 401) — `src/pages/admin/login.astro`'s script reads them.
- **Validation:** body `{user, password}` JSON; empty → 400 `invalid`; bad JSON → 400 `bad_request`.
- **Error UX:** login page shows its existing "invalid" message; 500 shows the existing generic error.
- **Validate:** curl rows A1–A4.

### Task 4: Admin management API hardening
- **Action:** modify
- **File:** `src/pages/api/admin/admins/index.ts`, `src/pages/api/admin/admins/[id].ts`
- **Pattern:** current files
- **Details:** Use `MIN_ADMIN_PASSWORD_LENGTH` in both (create + password change). `isSelf` compares against the D1 id (env admin id 0 is never "self" of a D1 row). A superadmin cannot demote or deactivate themselves (400, same message style as the self-delete guard). Payload cap 4 KB (`request.text()` + length check like `tickets/checkout.ts`). Keep `requireAdmin` first.
- **Gotcha:** Env admin (id 0) must still be able to create the first D1 superadmin (it is the bootstrap path if Julio chooses it).
- **Validation:** email contains `@` (≤ 120), name non-empty (≤ 100), password ≥ min length, role ∈ {admin, superadmin}.
- **Error UX:** `AdminsDashboard.tsx` already shows the API `error` string in its dialog; update its client-side min-length check/text to the same number.
- **Validate:** curl rows A5–A8.

### Task 4b: Local secrets example
- **Action:** modify
- **File:** `.dev.vars.example`
- **Pattern:** current file
- **Details:** Add `ADMIN_SESSION_SECRET=""` with a comment: random ≥ 32 chars (`openssl rand -hex 32`), required for admin login. Fix the stale "HTTP Basic Auth" comment (it is a cookie session now).
- **Gotcha:** never write a real value; `.dev.vars` (gitignored) gets a locally generated value for `astro dev` only.
- **Validate:** `git diff .dev.vars.example` shows no value.

**Phase 1 commit:** `fix(admin): dedicated session secret, revocable sessions and credential-free admins migration`

### — PHASE 2: Ticket money path —

### Task 5: Atomic ticket issuance (paid, free, courtesy)
- **Action:** modify
- **File:** `src/lib/tickets.ts`
- **Pattern:** `db.batch` usage in `src/lib/orders.ts` (`createPendingOrder`)
- **Details:**
  - `issueTicketsForOrder`: one `db.batch([...inserts, claim])` where each insert is `INSERT INTO tickets (ticket_order_id, event_id, code) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM ticket_orders WHERE id = ? AND status = 'completed' AND tickets_issued = 0)` and the last statement is the existing claim `UPDATE … SET tickets_issued = 1 WHERE id = ? AND status='completed' AND tickets_issued = 0`. The batch is one transaction: either all N tickets + the flag, or nothing. A losing concurrent caller inserts 0 rows (`EXISTS` false) and its claim changes 0 rows. Read `meta.changes` of the claim result to know who won; losers return the existing codes. Keep the oversell `console.error` (computed before the batch).
  - Free path in `createPendingTicketOrder` and `createCourtesyTicketOrder`: one `db.batch([insertOrder, ...insertTickets])` where tickets reference the order by `(SELECT id FROM ticket_orders WHERE bold_order_id = ?)`; then read the order id. Order + tickets exist together or not at all.
  - Recovery for orders already stuck in production (`status='completed' AND tickets_issued=1` with 0 tickets): `issueTicketsForOrder` treats "claimed but 0 tickets" as unclaimed — the insert guard becomes `… AND (tickets_issued = 0 OR NOT EXISTS (SELECT 1 FROM tickets WHERE ticket_order_id = ?))` and the claim the same; document why.
- **Gotcha:** Ticket code collisions (`code UNIQUE`) would now roll back the whole batch; retry the batch once with fresh codes on a UNIQUE error (32^10 space, practically never). Do not change code format, alphabet or length (QR codes already printed/saved by buyers).
- **Validate:** curl rows T6–T9 + the SQL checks in Test Tasks (exactly `quantity` rows; double confirm/webhook → still `quantity`).

### Task 5b: Close sales at the event's real start time
- **Action:** modify
- **File:** `src/lib/tickets.ts`
- **Pattern:** `nowIso()` (line 66)
- **Details:** Replace `nowIso()` in the three "past event" checks (`getVisibleEvents`, `getEventBySlug`, `createPendingTicketOrder`) with `nowBogotaWallClock()` = `new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 16)` (`YYYY-MM-DDTHH:MM`), with a comment: events store Colombia wall-clock time without zone; Colombia is UTC-5 all year. Keep `nowIso()` for `paid_at` (that one is a real UTC timestamp).
- **Gotcha:** `event_date` may carry seconds (`…T20:00:00`); string comparison still works (equal prefix, longer string sorts after). An event at 20:00 is on sale at 19:59 and gone at 20:00 Bogotá.
- **Validate:** curl row T12: an event dated 2 h ahead in Bogotá time is listed and sells (201); one dated 1 min in the past (Bogotá) returns 400 "El evento no está disponible" and is not listed.

### Task 6: Webhook: drop the misnamed signature check
- **Action:** modify
- **File:** `src/pages/api/bold-webhook.ts`, `src/lib/bold.ts`
- **Pattern:** `main`'s version of the webhook comment (trigger-only + voucher re-query)
- **Details:** Remove the `bold-signature` block and `verifyWebhookSignature` (Bold never sends that header, so production behavior does not change). Restore the security note: the payload is only a trigger; `confirmBoldOrder` re-queries the voucher; add `TODO(bold-webhook-signature)` citing the documented scheme (`x-bold-signature`, HMAC-SHA256 hex over Base64(raw body), empty key in test mode) and log `console.info("Bold webhook: x-bold-signature present", Boolean(header))` so the O6 test webhook shows whether the header arrives. Keep ticket issuance after confirm.
- **Gotcha:** Do not add a 401 path: a wrong key in test mode (empty string) would reject real webhooks.
- **Validate:** curl row W1–W3 (fake TIX/ORD/legacy ids → 200, no 401, routed to the right table).

### Task 7: Checkout and confirm endpoint fixes
- **Action:** modify
- **File:** `src/pages/api/tickets/checkout.ts`, `src/pages/api/tickets/confirm.ts`
- **Pattern:** `src/pages/api/store/checkout.ts`, `src/pages/api/store/confirm.ts`
- **Details:** checkout: if keys are missing, refuse paid checkouts BEFORE creating the row — resolve the event price first (export a small `getEventPriceBySlug` or let `createPendingTicketOrder` accept a `paymentsEnabled` flag and throw `CheckoutError(…, 500)` before inserting when the event is paid). confirm: parse the body with try/catch → 400 on bad JSON; after confirm + issuance, report `status = view.order.status === "completed" ? "completed" : result.donorStatus` and return tickets whenever the DB order is completed.
- **Gotcha:** The checkout response shapes (`free:true` vs Bold fields) and the signed `amount` string must not change — `TicketCheckoutForm.tsx` reads them.
- **Validation:** checkout — `eventSlug` string ≤ 160, `quantity` int 1–10, `buyer.name` ≤ 100 required, `buyer.email` regex ≤ 120, payload ≤ 4 KB (413). confirm — `orderId` string starting `AFROIN-TIX-`.
- **Error UX:** unchanged: inline error under the pay button; receipt phases loading/success/pending/failed.
- **Validate:** curl rows T1–T5, T10–T11.

**Phase 2 commit:** `fix(tickets): atomic ticket issuance, sales close at start time, confirm reports paid orders`

### — PHASE 3: Config and third-party scripts —

### Task 8: Preview vars and pinned third-party scripts
- **Action:** modify
- **File:** `wrangler.json`, `src/components/TicketQR.tsx`, `src/components/CheckinScanner.tsx`
- **Pattern:** `previews` block in `wrangler.json`
- **Details:** `previews.vars.PUBLIC_GOOGLE_MAPS_API_KEY` = same public key as top level (already restricted to afroin.org, *.afroin.org, *.workers.dev, localhost — O2). TicketQR: add `integrity="sha384-…"` (compute from the exact file: `curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A`) and `crossOrigin="anonymous"` to the script element. Scanner: pin `barcode-detector` to the exact current 2.x version (`npm view barcode-detector@2 version` → newest 2.x older than two weeks) in the esm.sh URL.
- **Gotcha:** SRI requires CORS; jsdelivr sends `Access-Control-Allow-Origin: *`. Same QR output (same library version) — buyers see identical codes.
- **Validate:** `npx wrangler deploy --dry-run` accepts the config (part of `npm run check`); in `astro dev`, a ticket page renders the QR (browser, no console SRI error); `/admin/checkin` loads the detector on a browser without native `BarcodeDetector` (Safari) at Level 5.

**Phase 3 commit:** `chore(tickets): Maps key for Previews and pinned third-party scripts`

### — PHASE 4: Staging data —

### Task 9: Staging migrations and fake rows
- **Action:** modify
- **File:** `seeds/preview.sql`
- **Pattern:** existing `[DEV]` product row (idempotent `INSERT OR IGNORE`)
- **Details:** Apply 0008–0010 to staging: `npx wrangler d1 migrations apply PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc --env-file=<main>/.env` (pre-approved; NEVER without `--config`). Add to the seed: `[DEV] Evento de prueba` (slug `dev-evento-de-prueba`, price 1000, capacity 20, date 2027-06-01T20:00, visible) and `[DEV] Evento agotado` (slug `dev-evento-agotado`, price 1000, capacity 1, visible) + one fake completed courtesy order (`[DEV] Asistente de prueba`, `dev@example.com`, amount 0) with one ticket, so it is sold out. Run the seed with `d1 execute PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc --file seeds/preview.sql`.
- **Gotcha:** No real personal data (rule 7). Ticket/order rows reference the event by slug subquery; keep every insert idempotent (fixed `bold_order_id`, `access_token`, `code`).
- **Validate:** `npx wrangler d1 migrations list PREVIEW_DB --remote --config …` → "No migrations to apply"; `SELECT slug, capacity, (SELECT COUNT(*) FROM tickets t WHERE t.event_id=e.id) FROM events e` shows both events.

**Phase 4 commit:** `chore(preview): ticketing seed rows for the staging D1`

## Interaction Matrix

| Action | Context | Expected Behavior |
|--------|---------|-------------------|
| Log in (D1 admin) | secret set | Cookie set, `/admin` loads |
| Log in | `ADMIN_SESSION_SECRET` missing | 500 not_configured; `/admin` redirects to login |
| Admin request | admin deactivated meanwhile | `/admin/*` → login redirect; `/api/admin/*` → 401 |
| Admin request | admin demoted meanwhile | superadmin-only actions → 403 |
| Superadmin edits self | role → admin or inactive | 400, unchanged |
| Pay with Bold | webhook + browser confirm both arrive | Exactly `quantity` tickets |
| Open `/entradas?bold-order-id=…` | Bold voucher call fails, order already completed | Success + QRs |
| Free event checkout | price 0 | Straight to `/entradas/<token>` with tickets (unchanged) |
| Courtesy issue | capacity left | One order + N tickets; nothing on failure |
| Scan valid code / same code again / garbage | `/admin/checkin` | ok ✓ / already ⚠ with time / not_found ✕ (unchanged) |
| Open event page | 1 min before start (Bogotá) / at start | On sale / redirect to `/eventos` (was: closed 5 h early) |
| Buy on sold-out event | stale tab | 400 "Entradas agotadas" inline (unchanged) |

## Test Tasks

> No test framework (`package.json` has no test script or test dependency). Validation = `npm run check` + the curl matrix below against `astro dev` with local D1 (NOT `wrangler dev`: `MessageChannel is not defined`). Rows are scripted in the session scratchpad and their outputs pasted in the execution report.

Local setup: `.dev.vars` in the worktree with the Bold TEST keys copied from the main checkout's `.dev.vars` plus a locally generated `ADMIN_SESSION_SECRET` and a local-only `ADMIN_PASSWORD`; local D1: `npx wrangler d1 execute afroin --local --file=migrations/000N_….sql` for 0001–0010 (local only), plus the staging seed rows.

- **Auth (after Phase 1):** A1 login with no secret → 500; A2 login env admin → 200 + cookie; A3 bad password → 401; A4 forged cookie (old format signed with ADMIN_PASSWORD, and a payload with flipped role) → 401 on `/api/admin/events`, 302 on `/admin`; A5 env admin creates D1 superadmin (password < min → 400); A6 D1 admin login → 200; A7 deactivate that admin from another superadmin → its cookie gets 401 immediately; A8 every `/api/admin/*` route without cookie → 401 (loop over all 19 route files).
- **Tickets (after Phase 2):** T1 checkout happy path 201 `AFROIN-TIX-`; T2 bad email 400; T3 qty 0/11 400; T4 unknown slug 400; T5 sold-out 400; T6 free event → order + exactly N tickets; T7 courtesy → exactly N; T8 simulate paid order (local SQL `UPDATE ticket_orders SET status='completed'`) then call `issueTicketsForOrder` twice concurrently via two confirm-equivalent requests → exactly N; T9 stuck order (`tickets_issued=1`, 0 tickets) → issuance repairs it to N; T10 confirm bad JSON → 400; T11 confirm on a completed order with an unreachable voucher (fake id) → `completed` + tickets; T12 sales cutoff (Task 5b); 413 on > 4 KB.
- **Webhook:** W1 legacy donation id, W2 `AFROIN-ORD-`, W3 `AFROIN-TIX-` → 200, no 401, routed by prefix (row unchanged because the voucher says NO_TRANSACTION).
- **Regression:** `/tienda` checkout API 201; `/api/bold-firma` (donation) 201; `/admin/pedidos`, `/admin/productos`, `/admin/donadores` load with a valid session; public `/eventos`, `/en/events`, `/fr/evenements`, detail and `/entradas/<token>` 200; bogus token 302.

## Validation Checklist

- [ ] **Level 1 — Lint & Format:** N/A — no lint script or config (`package.json`). Match neighboring style.
- [ ] **Level 2 — Type Check:** `npm run check` (astro build + tsc + wrangler deploy --dry-run), per phase and on the final branch.
- [ ] **Level 2.5 — Code Review:** `code-review` skill on each phase's files before its commit; one fresh-context review of the whole branch diff (`git diff origin/dev...HEAD`) by a new agent before the PR. Findings fixed or justified; review saved in `.agents/code-reviews/d1-finish-ticketing.md`.
- [ ] **Level 3 — Unit Tests:** N/A — no framework; the curl matrix replaces it.
- [ ] **Level 4 — Integration:** curl matrix above against `astro dev`.
- [ ] **Level 5 — Human Review (branch Preview, before the PR is merged):** before each check `curl -sI <preview-url>` (200, `x-robots-tag` noted). Preview URL from Workers Builds after pushing the branch. Needs `ADMIN_SESSION_SECRET` on that Preview (Julio). Checks:
  1. Bold TEST purchase of `[DEV] Evento de prueba` (1,000 COP) — **Julio** (payment form on a non-local host). Agent then reads staging D1: order `completed`, exactly `quantity` tickets. If no webhook arrives, Julio uses Bold's "Probar el webhook" button; agent checks the logs for the `x-bold-signature` line. Skipped → the paid path ships unobserved on Workers.
  2. QR on iPhone (Safari) and Android (Chrome): open the ticket link, scan at `/admin/checkin` — **Julio** (devices + admin login). Skipped → camera/ponyfill path unverified on real phones.
  3. Manual code entry and duplicate scan (⚠ with time) — Julio, same session.
  4. Sold out: `[DEV] Evento agotado` page shows sold-out and the checkout API refuses — agent (curl) + Julio (look).
  5. Regression: one TEST donation and one TEST store order (`[DEV] Producto de prueba`) complete — **Julio** (payments).
  6. Admin accounts: create an admin, log in with it, deactivate it, see it logged out — Julio.

## Acceptance Criteria

- [ ] `migrations/0010_create_admins.sql` has no INSERT and no credential; runs twice without error.
- [ ] No session is accepted without `ADMIN_SESSION_SECRET`; no fallback secret exists in code (`grep -rn "afroin-secret-auth-seed\|BOLD_SECRET_KEY" src/lib/adminAuth.ts` → nothing).
- [ ] Deactivated/deleted/demoted admins lose access on their next request.
- [ ] Paid, free and courtesy orders always have exactly `quantity` tickets; stuck orders self-repair on the next confirm/webhook.
- [ ] Buyer-visible pages and responses unchanged except what Julio approved in Domain Assumptions.
- [ ] Staging D1 at 0010 with seed rows; `npm run check` green; curl matrix green; Level 5 done; fresh-context review done; PR to `dev` open.

## Confidence Score: 8/10

- **Strengths:** Code already runs in production; every fix is local to a few files with in-repo patterns; D1 batch atomicity is documented; middleware needs no change.
- **Uncertainties:** Bold sandbox webhooks only via "Probar el webhook"; Level 5 depends on Julio's devices and on the Preview having `ADMIN_SESSION_SECRET`.
- **Mitigations:** Idempotent 0010; no 401 path in the webhook; browser confirm covers a missing webhook; Level 5 steps prepared so Julio only does the parts that need him.

## What Julio does (not the agent)

- Set `ADMIN_SESSION_SECRET` (random ≥ 32 chars) in the Previews Base config and on this branch's Preview (`npx wrangler preview secret put ADMIN_SESSION_SECRET --name <preview>`), and in production BEFORE the D1 release (without it production admin login stops working — fail closed).
- At release: no production migration is needed (0008–0010 schema already there, verified 2026-10-27). Record "0008–0010 present in production (verified 2026-10-27)" in the work list's *Applied in production*; never re-run 0009 (not idempotent).
- Level 5 steps marked "Julio".

## Notes for Executing Agent

- Work in the worktree; never touch `src/middleware.ts` or `public/_headers` (D6).
- Wrangler from the worktree: `npx wrangler <cmd> … --env-file=/Users/juliochemoreno/Projects/personal/afroin-web/afro-in/.env` (flag AFTER the command). Never print credentials. Never run `d1 migrations apply` without `--config wrangler.preview-migrations.jsonc`.
- Commits: Conventional Commits, author juliochemoreno@gmail.com (repo-local `user.email`), `Co-Authored-By` trailer; push the branch and open the PR to `dev` (standing approvals). Do not touch `main`.
- Do not change the ticket code format, the QR content (raw code) or the Bold order-id format.
- Report in Spanish to Julio: branch, all SHAs, `npm run check` + curl matrix results, Preview URL, code-review artifact, what is left for Julio.

> **UI Styling Note:** No new UI. Only `AdminsDashboard.tsx` password-length text changes.
>
> **Expected UX iterations: 1** — admin password rule text and any copy Julio adjusts after Level 5.

## Execution notes (2026-10-28)

- **Store return bug fixed here (Julio's OK, 2026-10-28: "Si, hay que corregir el fallo de la tienda").** Since June 2026 (33f5c7a, the Bold donation return handler in `src/layouts/Layout.astro`), every page opened with `?bold-order-id=` except `/gracias` was redirected to `/gracias`. A store buyer returning to `/pedido` was sent to the donation thank-you page; the navigation cancelled the in-flight `/api/store/confirm` (Workers log `outcome: canceled`), and `/api/bold-confirmar` only updated `donors`. In production store orders were completed only by the Bold webhook, and buyers never saw their order receipt. Found in Level 5 (staging order 1 stayed `pending` with Bold `APPROVED`). Fix: the handler routes by prefix (`AFROIN-TIX-` → `/entradas`, `AFROIN-ORD-` → `/pedido`, donations → `/gracias` as before) and `/api/bold-confirmar` picks the table through `CONFIRM_TARGETS` (ticket ids → 400). Donation flow unchanged.
- Review fixes beyond the plan: see `.agents/code-reviews/d1-finish-ticketing.md` (open redirect in `/admin/login`, CSV formula injection, confirm hardening, event delete order, bearer-page headers).
