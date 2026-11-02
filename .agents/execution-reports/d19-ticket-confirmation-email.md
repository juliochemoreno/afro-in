# Execution report: D19 — ticket confirmation email (+ tickets page redesign)

## Meta Information

- **Plan:** `d19-ticket-confirmation-email` — `.agents/plans/done/d19-ticket-confirmation-email.md`
- **PR:** [juliochemoreno/afro-in#26](https://github.com/juliochemoreno/afro-in/pull/26) into `dev`, merged by the orchestrator as `f478d4b` (head `bec4777`, CI green). Released with the end-of-day release PR #27 (`dev` → `main`).
- **Branch commits** (`claude/d19-confirmation-email-d18c91`, base `bf6bc27`):
  - `87bf2c6` phase 1: migration 0013, order language, `qrcode-generator`, config
  - `c330d93` phase 2: Resend client, ticket email builder, tests
  - `a7e2ecd` phase 3: send-once claim, triggers, admin send/resend
  - `87ce71a` fresh-context review fixes
  - `4fd7a7c` shared email layout + Julio's email review
  - `bec4777` tickets page redesign + random purchase reference
- **Files added:**
  - `migrations/0013_add_ticket_order_email.sql`
  - `src/lib/email.ts`, `src/lib/emailLayout.ts`, `src/lib/emailLogo.ts`, `src/lib/ticketEmail.ts`, `src/lib/ticketEmailSend.ts`, `src/lib/orderRef.ts`
  - `src/pages/api/admin/tickets/[id]/email.ts`, `src/pages/dev/email-preview.ts`
  - `tests/email.test.ts`, `tests/ticket-email.test.ts`, `tests/email-layout.test.ts`, `tests/order-ref.test.ts`
  - `.agents/code-reviews/d19-ticket-confirmation-email.md`, `.agents/code-reviews/d19-ui-iteration.md`, the plan
- **Files modified:** `package.json`, `package-lock.json`, `wrangler.json`, `worker-configuration.d.ts`, `.dev.vars.example`, `src/lib/tickets.ts`, `src/lib/eventDisplay.ts`, `src/pages/api/bold-webhook.ts`, `src/pages/api/tickets/{checkout,confirm}.ts`, `src/pages/api/admin/tickets/courtesy.ts`, `src/components/{TicketCheckoutForm,TicketOrdersDashboard,TicketQR,TicketList,TicketReceipt}.tsx`, `src/templates/EntradasTemplate.astro`, `src/i18n/locales/{es,en,fr}.json`, `tests/event-display.test.ts`
- **Lines changed:** +1740 −202 (37 files, `git diff --stat f478d4b^1 f478d4b`)
- **New dependency:** `qrcode-generator@2.0.4` (MIT, no deps), approved by Julio.

## What shipped

- **Email** via Resend (plain `fetch`): from `AFRO IN <entradas@afroin.org>`, reply-to `afroinsantamarta@gmail.com`, es/en/fr from `ticket_orders.locale`; event range in Colombia time, venue, full-width "Ver mis entradas" button to the permanent link, one inline (CID) QR per ticket. `[PRUEBA] ` subject prefix outside production.
- **Triggers:** Bold webhook, receipt confirm, free reservation, admin courtesy — all through `sendTicketEmail` in `waitUntil`.
- **Exactly once:** atomic claim on `email_status` (NULL → sending) + Resend `Idempotency-Key`; failed sends retry on the next trigger (max 3); stale `sending` reclaimed after 10 min; a failed admin resend never reopens automatic retries. Production links pinned to `https://afroin.org`.
- **Admin:** email status + "Enviar / Reenviar correo" in the order detail; courtesy dialog gets the email language.
- **Shared email layout** (`emailLayout.ts`, logo header, footer with site/Instagram/reply/reason, brand colors on dark, button helper) for D24, donations and store. Dev-only preview `/dev/email-preview` (always 404 in a build).
- **Tickets page** (Julio's Level 5): QR rendered with the bundled library (server HTML, no CDN); event once, compact tickets (grid on desktop, carousel on phones); one red button; pending/failed/not-found states with WhatsApp + email; random 8-char purchase reference instead of the sequential id (also in `/api/tickets/confirm`); `eventTime` keeps "p. m.".

## Production and environments (done)

- Migration `0013`: applied on staging (orchestrator) and production (Julio, verified: 6 columns, 3 old orders `skipped`).
- `RESEND_API_KEY`: set by Julio in production and on the dev Preview. Domain `afroin.org` verified in Resend (DKIM/SPF/MX in Cloudflare DNS).
- Dev check: TEST purchase on dev.afroin.org → order #8 `completed`, `email_status = 'sent'`, 1 attempt.

## Validation Results

- **Linting:** not applicable (no linter).
- **Type checking:** ✓ `npm run check` exit 0 on `bec4777`.
- **Unit tests:** ✓ 97/97 (orchestrator 97/97 on `f478d4b`).
- **Integration (local `astro dev` :4325):** ✓ no key → no send, no DB change; invalid key → routes 200, error stored; two parallel confirms → one attempt; 3-attempt cap; `skipped` orders untouched; admin email endpoint 401 without session; QR in server HTML (2/2, no CDN); real sends es/en/fr + multi-day to Julio.
- **Human review:** ✓ Julio, 2026-11-01: emails in Gmail and Spark (dark mode), tickets page desktop and phone.

## Code Review Findings

- `.agents/code-reviews/d19-ticket-confirmation-email.md` — branch review: 0 critical/high, 3 medium + 4 low; all medium and 3 low fixed (`87ce71a`), L1 mostly removed by the M2 fix.
- `.agents/code-reviews/d19-ui-iteration.md` — UI iteration review: 3 low fixed (sequential id in the confirm response, pending icon in light mode, copy-link fallback), notes recorded.

## Divergences from Plan

- **Scope added during Level 5 (Julio, via the orchestrator):** shared email layout, dev preview page, five rounds of email design (brand colors, logo, dark background, copy, one QR per row, square full-width button, neutral separators), the tickets page redesign (QR without CDN, desktop/phone layouts, error states, purchase reference). Reviewed separately (`d19-ui-iteration.md`).
- `TicketQR.tsx` one-line type fix in phase 1 (the package declares a global `qrcode`), later replaced by the bundled import.
- Courtesy language select landed in phase 3, not phase 1.
- Test emails went first to julio@hopla.tools, then (Julio's instruction) only to juliochemoreno@gmail.com.

## Not verified

- Door scan of an email QR at `/admin/checkin` (same string and settings as the page QR the scanner reads).
- Admin send/resend with a real admin session (only the 401 path locally).

## Follow-ups

- Store receipt (`OrderReceipt.tsx`) still shows the sequential order id.
- Admin: correct a buyer's email and resend.
- French site copy mixes "vous" (older strings) and "tu" (new ones); browser tab title stays "Tus entradas" on error states.
- D24 reuses `email.ts`, `emailLayout.ts`, `emailLogo.ts`. Marketing email will need consent + unsubscribe (noted in `emailLayout.ts`).
