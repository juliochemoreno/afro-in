# Plan: D19 — Ticket confirmation email

## Overview
When a ticket order becomes completed (Bold payment confirmed, free reservation, or admin courtesy), the buyer gets ONE email via Resend with their tickets: event, date (Colombia time), venue, a button to the permanent tickets link, and each ticket's QR + code, in the buyer's language (es/en/fr). Today the link exists only on screen and a buyer who loses it cannot recover it. D24 (passwordless account) will reuse the sending helper.

## Requirements Summary
- Sender `AFRO IN <entradas@afroin.org>`, reply-to `afroinsantamarta@gmail.com` (Julio, 2026-11-01).
- Triggers: paid order completed (webhook OR receipt confirm, whichever wins), free reservation, admin courtesy. Old orders (completed before this release) get nothing automatically.
- Exactly once: concurrent/duplicate Bold confirmations send one email (atomic claim in D1 + Resend `Idempotency-Key`).
- Email failure never breaks payment confirmation, ticket issuance, the receipt or the webhook response. It is logged and recorded on the order; automatic retries (max 3 attempts) on the next trigger; admin can send/resend from the order detail at any time.
- QR codes rendered server-side with `qrcode-generator` (approved by Julio 2026-11-01) and embedded as inline CID image attachments.
- Buyer language stored on the order (`locale`), sent by the checkout form; courtesy form gets a language select (default es).
- Dev/previews/local send real email to whoever buys (only testers buy there), subject prefixed `[PRUEBA] ` via a var that production does not have.
- Copy approved by Julio (es; en/fr faithful translations) — see Task 4.
- Workflow classification: **async data-arrival** (webhook / confirm / checkout trigger a background send via `ctx.waitUntil`) for automatic sends; **sequential user-driven** for the admin "Enviar correo" button (one handler, awaited, result shown).

## Out of Scope
- Editing the buyer's email from the admin before resending (Likely follow-up).
- Bulk sending to old orders.
- Store (merch) order and donation emails.
- Email open/bounce tracking, Resend webhooks.
- Verifying Bold's webhook signature (existing TODO, unrelated).
- The `/entradas/<token>` page visit does NOT trigger the email (it already shows the tickets).
- Expected UX iterations: 3 (email layout across Gmail web/iOS Mail/Outlook, plus the admin button).

## Likely Follow-ups
- Admin: correct the buyer's email and resend.
- D24 reuses `src/lib/email.ts` for the sign-in code.
- Store order confirmation email; donation receipt email.
- Resend webhook for bounces → mark `email_status='bounced'`.

## Git Strategy
- **Base branch:** `dev` (worktree already on `claude/d19-confirmation-email-d18c91`, cut from dev at bf6bc27)
- **Feature branch:** `claude/d19-confirmation-email-d18c91` (Claude worktree branch; PR to `dev`)

## Context References
Verified during planning (2026-11-01):
- `src/lib/tickets.ts:649-747` `issueTicketsForOrder(db, boldOrderId)` — idempotent, race-safe issuance; returns `{issued, codes}`; `issued > 0` only for the caller whose batch claimed `tickets_issued 0→1`. Called from 3 places: `src/pages/api/bold-webhook.ts:63-69` (ticket kind, try/catch), `src/pages/api/tickets/confirm.ts:73,79`, `src/lib/tickets.ts:797` (`getTicketOrderByToken` repair). The email is NOT tied to `issued > 0` (a crash between issuance and email would lose it); instead a separate D1 claim on `email_status` (Task 1/5) makes "send once" independent of who issued.
- `src/lib/tickets.ts:320-518` `createPendingTicketOrder` — free orders (`unit === 0`) are inserted `completed` with tickets in one batch (line 492-496); no confirm call follows (client redirects to `/entradas/<token>`, `TicketCheckoutForm.tsx:162-164`). Returns `orderId` (Bold id) and `accessToken`.
- `src/lib/tickets.ts:539-616` `createCourtesyTicketOrder` — order + tickets in one batch, `provider='courtesy'`; called by `src/pages/api/admin/tickets/courtesy.ts:26`.
- `src/pages/api/tickets/checkout.ts:47-58` — free response path; `locals.runtime.env`.
- `migrations/0008_create_ticketing.sql` — `ticket_orders` columns: id, bold_order_id, status, provider, provider_status, transaction_id, currency, amount, event_id, event_name (es snapshot), unit_price, quantity, buyer_name, buyer_email, buyer_phone, access_token, tickets_issued, created_at (UTC `YYYY-MM-DD HH:MM:SS`), paid_at. No locale column today: `grep -n "locale\|lang" src/pages/api/tickets/checkout.ts` → 0 hits; `TicketCheckoutForm.tsx:127-140` does not send `lang` (the component has `lang` prop, line 12).
- `migrations/0012_add_event_end_date.sql` — last migration; next is `0013`. `events` has name_es/en/fr, venue, city, event_date (Bogotá wall clock `YYYY-MM-DDTHH:MM`), end_date.
- `src/lib/eventDisplay.ts` — pure (no `@/` imports, tested directly): `shortDateRange(eventDate, lang, endDate)` (line 125), `eventTime(eventDate, lang)` (line 88), `localeTag`. Reuse for the email date line — no new date code.
- `src/i18n/routes.ts:13,28,43` — tickets path per locale: `/entradas`, `/tickets`, `/billets` (en/fr pages under `/en`, `/fr`: `src/pages/en/tickets/[token].astro`, `src/pages/fr/billets/[token].astro`).
- `src/components/TicketQR.tsx:85-92` — QR content is the plain ticket code, `qrcode(0, "M")`, `createDataURL(6, 6)`. The email QR must encode the same string so the door scanner (`CheckinScanner.tsx`) reads it.
- `src/components/TicketOrdersDashboard.tsx:339-351` — admin detail dialog fetches `/api/admin/tickets/${id}`; courtesy dialog state at lines 222-226. `src/pages/api/admin/tickets/[id].ts` — `requireAdmin` pattern for the new endpoint.
- `node_modules/@astrojs/cloudflare/dist/utils/handler.d.ts:16` — `locals.runtime.ctx: ExecutionContext` → `locals.runtime.ctx.waitUntil(promise)`. No existing `waitUntil` use in `src` (`grep -rn waitUntil src` → 0).
- `wrangler.json` — `vars` (production), `previews.vars`, `env.local.vars`; secrets typed in `worker-configuration.d.ts:5-7` (`BOLD_API_KEY`, `BOLD_SECRET_KEY`); `.dev.vars.example` lists local secrets.
- `package.json` scripts: `check` = astro build + tsc + wrangler dry-run; `test` = `node --experimental-strip-types --test "tests/**/*.test.ts"`. No lint script.
- `.agents/orchestrator.md` — project rules: migrations additive, Julio applies production migration BEFORE merge; preview D1 migrations only with `--config wrangler.preview-migrations.jsonc`; `astro dev` (not wrangler dev) for local; component scripts register on `astro:page-load`; credentials via `--env-file=<main checkout>/.env` after the command.

Spikes run while planning:
- `qrcode-generator@2.0.4` (MIT, no deps; published 2025-08-07; ESM `dist/qrcode.mjs`, types `dist/qrcode.d.ts`). `npm pack` into scratchpad + `node spike.mjs` (`qrcode(0,"M"); addData("K7P29XQ4MA"); make(); createDataURL(6,6)`) → `data:image/gif;base64,R0lGODdhigCKAIAAAA… 1562 chars`, `typeof document === "undefined"`: pure JS, no DOM/canvas, works outside the browser. Workers runtime still to confirm in Level 4 (pure JS, expected fine).
- Resend API (https://resend.com/docs/api-reference/emails/send-email, read 2026-11-01): `POST https://api.resend.com/emails`, `Authorization: Bearer <key>`, JSON `from, to, subject, html, text, reply_to, headers, attachments[{content (base64), filename, content_type?, content_id}], tags[{name,value}]`; header `Idempotency-Key` (≤256 chars, 24 h). Inline images: `<img src="cid:<content_id>">`. The exact REST field name `content_id` is to be confirmed by Task 0's first real send (fallback below).
- Gmail strips `data:` image URIs → CID attachments are required for visible QR images.

## Domain Assumptions
- "Completed" = `ticket_orders.status = 'completed'` AND `tickets_issued = 1` AND tickets exist; the email is sent only then (never for pending/rejected).
- Old orders: migration sets `email_status = 'skipped'` for every order already `completed` at migration time; they only get an email from the admin button.
- Orders completed between the production migration and the release (old code running) keep `email_status = NULL` and DO get the email on their next trigger (receipt reload, Bold webhook retry) — acceptable: they are recent real buyers.
- Automatic retries: a failed send is retried by the next trigger (webhook retry, receipt reload) up to 3 attempts total; after that only the admin button sends.
- A claim stuck in `sending` for more than 10 minutes (worker killed mid-send) counts as failed and can be retried; Resend's 24 h `Idempotency-Key` prevents a duplicate if the first send actually went out.
- Admin "Enviar correo" sends regardless of the current status (sent, skipped, failed), to the stored buyer email, with a new idempotency key per click.
- Courtesy guests receive the email exactly like buyers (Julio).
- Missing `RESEND_API_KEY` → no send, warn log, `email_status` stays NULL (the next trigger after the key is set sends).

## Implementation Tasks

### Task 0: Install qrcode-generator and prove a real send (spike)
- **Action:** modify
- **File:** `package.json`, `package-lock.json`
- **Pattern:** N/A
- **Details:** `npm install qrcode-generator@2.0.4 --save-exact` (approved by Julio). After Tasks 3-4 exist, before wiring hooks, Julio puts `RESEND_API_KEY` in the worktree's `.dev.vars` himself (never read or printed by the agent) and the agent runs a one-off local script/endpoint call that sends one ticket email for a local free order to Julio's address. Confirms: inline CID QR visible in Gmail, `content_id` field name, from/reply-to.
- **Gotcha:** Until afroin.org is verified in Resend, sending from `entradas@afroin.org` fails (403 domain not verified). Fallback for the spike only: `from: "AFRO IN <onboarding@resend.dev>"`, which Resend only delivers to the account owner's address. If `content_id` is not accepted, try `contentId`. If inline images still do not render, do NOT host QR images on a public URL (it would hand ticket codes to mail image proxies); fall back to the "code + button, no QR" layout and tell Julio.
- **Validate:** `npm ls qrcode-generator` shows 2.0.4; Julio confirms the spike email shows the QRs in Gmail.
- **Time-box:** 30 min for the inline-image proof; then fall back as above.

### Task 1: Migration 0013 — locale and email tracking on ticket_orders
- **Action:** create
- **File:** `migrations/0013_add_ticket_order_email.sql`
- **Pattern:** `migrations/0012_add_event_end_date.sql`
- **Details:**
  ```sql
  ALTER TABLE ticket_orders ADD COLUMN locale TEXT;            -- es | en | fr, NULL = es
  ALTER TABLE ticket_orders ADD COLUMN email_status TEXT;      -- NULL due | sending | sent | failed | skipped
  ALTER TABLE ticket_orders ADD COLUMN email_attempts INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE ticket_orders ADD COLUMN email_attempt_at TEXT;  -- UTC datetime('now') of the last claim
  ALTER TABLE ticket_orders ADD COLUMN email_sent_at TEXT;
  ALTER TABLE ticket_orders ADD COLUMN email_error TEXT;       -- last failure, truncated, no secrets
  UPDATE ticket_orders SET email_status = 'skipped' WHERE status = 'completed';
  ```
  Header comment: why (D19), additive, the backfill only touches the new column.
- **Gotcha:** Production: Julio applies it BEFORE merging (old code ignores the new columns). Never `d1 migrations apply` without `--config wrangler.preview-migrations.jsonc` (that targets production). Local: `npx wrangler d1 execute DB --local --env local --file migrations/0013_add_ticket_order_email.sql`.
- **Validate:** apply locally; `npx wrangler d1 execute DB --local --env local --command "PRAGMA table_info(ticket_orders)"` lists the 6 columns; staging: `npx wrangler d1 migrations apply PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc --env-file=<main checkout>/.env`.

### Task 2: Store the buyer's language on the order
- **Action:** modify
- **File:** `src/lib/tickets.ts`, `src/components/TicketCheckoutForm.tsx`, `src/pages/api/admin/tickets/courtesy.ts` (no change needed if body passes through), `src/components/TicketOrdersDashboard.tsx` (courtesy dialog)
- **Pattern:** existing `clean()` input handling in `createPendingTicketOrder`
- **Details:** `TicketCheckoutInput` and `CourtesyTicketInput` get `lang?: string`; a helper `orderLocale(raw): "es"|"en"|"fr"` (whitelist, default "es"); both INSERTs add the `locale` column. Checkout form sends `lang` in the JSON body. Courtesy dialog: a small Idioma select (Español / English / Français, default Español) sent as `lang`.
- **Gotcha:** `createPendingTicketOrder` uses numbered params `?1..?17` — add `locale` as `?18` (do not renumber). Old clients (cached page) send no `lang` → "es".
- **Validate:** local checkout of a free event from `/en/events/<slug>` → `SELECT locale FROM ticket_orders ORDER BY id DESC LIMIT 1` = `en`.
- **Validation:** `lang` optional; anything not es/en/fr → es. Payload limit unchanged (4096 bytes).
- **Error UX:** N/A (never rejects).

### Task 3: Resend client
- **Action:** create
- **File:** `src/lib/email.ts`
- **Pattern:** `src/lib/bold.ts` (plain `fetch` to a provider API)
- **Details:** `sendEmail(apiKey, msg: {from, to, replyTo?, subject, html, text, attachments?: {filename, content, contentId}[]}, opts: {idempotencyKey?: string}): Promise<{ok: true; id: string} | {ok: false; status: number; error: string}>`. Maps to Resend's snake_case body. Never throws (network errors → `{ok:false,status:0}`). Constants `TICKETS_FROM = "AFRO IN <entradas@afroin.org>"`, `TICKETS_REPLY_TO = "afroinsantamarta@gmail.com"`. Error text truncated to 300 chars; never include the key or the request body in logs.
- **Gotcha:** No SDK (no dependency). Timeout: `AbortSignal.timeout(10_000)`.
- **Validate:** covered by Task 0 spike + unit test of the body mapping (Task 9) with a stubbed `fetch`.

### Task 4: Ticket email builder (pure)
- **Action:** create
- **File:** `src/lib/ticketEmail.ts`
- **Pattern:** `src/lib/eventDisplay.ts` (pure, relative `.ts` imports, tested directly)
- **Details:** `buildTicketEmail({lang, buyerName, event: {name, venue, city, eventDate, endDate}, tickets: {code}[], ticketsUrl, subjectPrefix}) → {subject, html, text, attachments}`. Strings per locale in a local dictionary (es approved by Julio; en/fr translations):
  - Subject: `Tus entradas · {event}` / `Your tickets · {event}` / `Vos billets · {event}`, prefixed by `subjectPrefix` (`[PRUEBA] ` on non-production).
  - Body: `Hola, {first name}:` → `¡Ya eres parte! Aquí están tus {n} entradas.` (singular: `tu entrada`) → event block once: name; `shortDateRange` + ` · ` + `eventTime` + ` (hora de Colombia)`; `venue, city` → button `Ver mis entradas` → `ticketsUrl` → per ticket: `Entrada {i}`, QR `<img src="cid:qr-{i}" width="180" height="180" alt="{code}">`, code below → `Muestra el QR en la entrada, desde el celular o impreso. Cada QR vale para una persona.` → `¿Preguntas? Responde a este correo.` → `Nos vemos en el festival.` → `AFRO IN`.
  - Event name per locale: `name_<lang>` falling back to `name_es`.
  - HTML: table layout, inline styles, cream background / dark text, gold thin rule (no boxed gold frames), max-width 560px; plain-text version with the same content and the link.
  - QR: `qrcode(0,"M")`, `addData(code)`, `createDataURL(6, 4)` → strip `data:image/gif;base64,` → attachment `{filename: "entrada-{i}.gif", content, contentId: "qr-{i}"}`.
  - Escape every interpolated value in HTML (buyer name, event name, venue).
- **Gotcha:** Not every event has a time or venue: omit missing parts, no dangling separators. Never repeat date/name/venue (Julio's rule). First name = first word of `buyer_name`.
- **Validate:** `node --experimental-strip-types --test tests/ticket-email.test.ts`.

### Task 5: Send-once orchestration
- **Action:** create
- **File:** `src/lib/ticketEmailSend.ts`
- **Pattern:** claim pattern of `issueTicketsForOrder` (`src/lib/tickets.ts:712-746`)
- **Details:** `sendTicketEmail(env, boldOrderId, {origin, force = false}): Promise<{status: "sent"|"skipped"|"failed"|"not_due"|"no_key"; error?: string}>`, never throws (outer try/catch → log + `failed`).
  1. No `env.RESEND_API_KEY` → `console.warn`, return `no_key` (no DB write).
  2. Claim (one statement):
     ```sql
     UPDATE ticket_orders
        SET email_status = 'sending', email_attempt_at = datetime('now'),
            email_attempts = email_attempts + 1
      WHERE bold_order_id = ? AND status = 'completed' AND tickets_issued = 1
        AND ( ?force = 1
              OR email_status IS NULL
              OR (email_status = 'failed' AND email_attempts < 3)
              OR (email_status = 'sending' AND email_attempt_at < datetime('now', '-10 minutes')) )
     ```
     `meta.changes === 0` → `not_due`.
  3. Load order + event + tickets (`getTicketOrderByBoldId`); zero tickets → mark failed (`no tickets`).
  4. `ticketsUrl = origin + (lang === "es" ? "" : "/" + lang) + routes[lang].tickets + "/" + access_token`.
  5. `buildTicketEmail` + `sendEmail` with `Idempotency-Key`: automatic `ticket-email/<boldOrderId>`; forced `ticket-email/<boldOrderId>/admin-<email_attempts>`.
  6. OK → `email_status='sent', email_sent_at=datetime('now'), email_error=NULL`; KO → `email_status='failed', email_error=<status: message>`; `console.error("ticket email failed", boldOrderId, status)` — never log the buyer email or token.
- **Gotcha:** `origin` must come from the request (`new URL(request.url).origin`), so dev/previews link to their own host. The webhook's origin is the Bold-configured webhook host (afroin.org in production). Do not log the access token / ticketsUrl.
- **Validate:** Level 4 matrix (below).

### Task 6: Hook the automatic triggers
- **Action:** modify
- **File:** `src/pages/api/bold-webhook.ts`, `src/pages/api/tickets/confirm.ts`, `src/pages/api/tickets/checkout.ts`, `src/pages/api/admin/tickets/courtesy.ts`
- **Pattern:** webhook's ticket-issuance try/catch (`bold-webhook.ts:63-69`)
- **Details:** After issuance (webhook, confirm) / after creation (free checkout, courtesy): `locals.runtime.ctx.waitUntil(sendTicketEmail(env, orderId, { origin }))`. Webhook and confirm: only for ticket orders, call unconditionally (the claim decides). Free checkout: only on the `isFree` path. Courtesy: always.
- **Gotcha:** Never `await` the send in these routes (response time, Bold retries); `waitUntil` keeps the Worker alive until it ends. `sendTicketEmail` never throws, so `waitUntil` never rejects. In `astro dev` (platformProxy) `ctx.waitUntil` exists; verify it actually runs the promise locally (Level 4) — fallback: `await` in dev only is NOT acceptable; if it does not run, report and decide with Julio.
- **Validate:** Level 4 matrix.

### Task 7: Admin send/resend
- **Action:** create + modify
- **File:** `src/pages/api/admin/tickets/[id]/email.ts` (create), `src/components/TicketOrdersDashboard.tsx` (modify), `src/lib/tickets.ts` (`getTicketOrdersForAdmin`/detail already `SELECT o.*` → new columns flow through)
- **Pattern:** `src/pages/api/admin/tickets/[id].ts`
- **Details:** `POST` with `requireAdmin`; id numeric; order must be `completed` with tickets (else 409 "La compra no está completada"); `await sendTicketEmail(env, bold_order_id, {origin, force: true})` → `{status, error?}`. Dashboard detail dialog: line "Correo: Enviado 01 nov 14:32 / Falló: <error> / No enviado / Enviando…" and a button "Enviar correo" (label "Reenviar correo" when already sent); shows the result inline, refreshes the row.
- **Gotcha:** Route file `[id]/email.ts` next to existing `[id].ts` — Astro allows `tickets/[id].ts` and `tickets/[id]/email.ts` together; confirm with build. `requireAdmin` is mandatory in every `/api/admin/*` endpoint (project rule 2).
- **Validate:** curl without session → 401; with session on a completed local order → `{status:"sent"}`.
- **Validation:** `id` positive integer; order exists (404), completed with tickets (409).
- **Error UX:** inline message under the button in the dialog (red text with the error), button re-enabled.

### Task 8: Config, types, docs
- **Action:** modify
- **File:** `wrangler.json`, `worker-configuration.d.ts`, `.dev.vars.example`
- **Pattern:** existing `PUBLIC_GOOGLE_MAPS_API_KEY` var / `BOLD_API_KEY` secret
- **Details:** `EMAIL_SUBJECT_PREFIX: "[PRUEBA] "` in `previews.vars` and `env.local.vars` only (NOT top-level `vars`). Env types: `RESEND_API_KEY: string; EMAIL_SUBJECT_PREFIX?: string`. `.dev.vars.example`: `RESEND_API_KEY=""` with a comment (dev key, never commit). 
- **Gotcha:** Public repo — no key anywhere in files. Previews: secrets copy only into Previews created after they are set; the existing `dev` Preview needs `npx wrangler preview secret put RESEND_API_KEY --name <dev preview>` (Julio types the value).
- **Validate:** `npm run check` passes; `git grep -n "re_[A-Za-z0-9]\{10,\}"` → 0 hits.

## Test Tasks

### Task 9: Unit tests
- **Action:** create
- **File:** `tests/ticket-email.test.ts`, `tests/email.test.ts`
- **Pattern:** `tests/event-display.test.ts`
- **Details:** ticket-email: subject per locale + prefix; `n` QR attachments with `contentId` `qr-1..n` and matching `cid:` refs; GIF base64 decodes (starts with `GIF8`); tickets URL present in html and text; event name per locale with es fallback; HTML-escapes `<script>` in buyer name; date line uses range for multi-day event and omits time/venue when missing; singular/plural copy; date/name/venue appear exactly once in html. email: body mapping (`reply_to`, `content_id`), `Idempotency-Key` header, network error → `{ok:false,status:0}` (stub `globalThis.fetch`).
- **Gotcha:** tests import with relative `.ts` paths; `ticketEmail.ts` must not import `@/…`.
- **Validate:** `npm test`.

### Regression check
- Paid checkout + receipt (confirm) still shows tickets and the link; webhook still returns 200 with the same JSON; free reservation still redirects to the tickets page; courtesy creation still returns codes; check-in scanner still reads a QR (scan the QR from the email at `/admin/checkin`).

## Phase Boundaries
1. Commit A — Tasks 0, 1, 2, 8 (dependency, migration, locale, config) — tests: none new; `npm run check` green.
2. Commit B — Tasks 3, 4, 9 (builder + client + their tests) — `tests/ticket-email.test.ts`, `tests/email.test.ts` green.
3. Commit C — Tasks 5, 6, 7 (orchestration, hooks, admin) — Level 4 matrix green.

## Validation Checklist
- [ ] **Level 1 — Lint & Format:** no lint script in this project (orchestrator.md); skip, say so in the report.
- [ ] **Level 2 — Type Check:** `npm run check`
- [ ] **Level 2.5 — Code Review:** `code-review` skill on the diff (money/personal-data path).
- [ ] **Level 3 — Unit Tests:** `npm test`
- [ ] **Level 4 — Integration (agent, local `astro dev --port 4325` with migrations + `seeds/local.sql` applied locally, Julio's `RESEND_API_KEY` in `.dev.vars`):**
  1. Free event checkout (es) → one email to the test address; `email_status='sent'`.
  2. Same from `/en/...` and `/fr/...` → English / French email, link to `/en/tickets/<token>` / `/fr/billets/<token>`.
  3. Paid TEST Bold purchase → receipt confirm → one email; reload the receipt 3× → still one (`email_attempts = 1`).
  4. Concurrency: fire `POST /api/tickets/confirm` twice in parallel for a completed order with `email_status NULL` → one `sent`, `email_attempts = 1`.
  5. Invalid key (Julio swaps `.dev.vars` to a bogus value) → confirm still 200 with tickets; `email_status='failed'`, error stored; restore key, reload receipt → `sent`, attempts 2.
  6. No key → confirm 200, no DB change, warn log.
  7. Courtesy from admin → email; admin "Reenviar correo" → second email; curl without session → 401.
  8. Old completed order (`email_status='skipped'`) → receipt reload sends nothing.
- [ ] **Level 5 — Human Review (Julio, local port 4325 from this worktree, before the PR):** read the received emails in Gmail (web + phone) in es/en/fr: copy and tone, no repeated info, QR visible and scannable with the door scanner (`/admin/checkin`), button opens the right tickets page, reply goes to afroinsantamarta@gmail.com, `[PRUEBA]` prefix present; admin button wording. Skipped → the email layout and QR scan ship unobserved to real buyers.
- [ ] **Fresh-context review:** one strongest-model review of the whole branch (personal data) before the PR; artifact in `.agents/code-reviews/`.

## Acceptance Criteria
- [ ] A paid order completed by webhook and confirm concurrently produces exactly one email.
- [ ] Email failure or missing key never changes the webhook/confirm/checkout/courtesy responses.
- [ ] The email is in the order's language with the correct localized tickets link.
- [ ] Each ticket's QR is visible in Gmail and scans at `/admin/checkin`.
- [ ] Orders completed before the migration get no automatic email; admin can send/resend any completed order.
- [ ] Non-production subjects start with `[PRUEBA] `; production does not.
- [ ] No secret, buyer email or access token in logs or the repo.

## Confidence Score: 8/10
- **Strengths:** single claim column makes "once" independent of the 3 issuance callers; QR lib proven outside the browser; Resend API shape read from docs; all decisions made with Julio.
- **Uncertainties:** Resend `content_id` exact field and Gmail CID rendering (Task 0); `ctx.waitUntil` behavior under `astro dev`; domain verification timing (Julio).
- **Mitigations:** Task 0 spike before hooks; time-boxed fallback; Level 4 matrix checks waitUntil locally.

## Notes for Executing Agent
- NEVER read `.env` or `.dev.vars`, never print/log/commit `RESEND_API_KEY`. Julio types secrets.
- Personal data: do not log buyer email, name or access token; error logs carry only the Bold order id and HTTP status.
- Production steps for Julio (report them verbatim):
  1. Resend: add domain `afroin.org`, copy its DNS records (DKIM TXT `resend._domainkey`, MX + SPF TXT on `send`, optional DMARC TXT `_dmarc`) into Cloudflare DNS with proxy OFF; wait for "Verified".
  2. Create two API keys ("sending access", domain afroin.org): production and dev.
  3. `npx wrangler secret put RESEND_API_KEY --env-file=<main checkout>/.env` (production key).
  4. Dev Preview + Previews base: `npx wrangler preview secret put RESEND_API_KEY --name <dev preview> --env-file=<main checkout>/.env` (dev key) and the Previews Base config in the dashboard.
  5. Apply `migrations/0013_add_ticket_order_email.sql` to production D1 BEFORE the release merge; record it in the work list.
- UI styling is provisional. Expected UX iterations: 3.
