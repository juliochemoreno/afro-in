# Code review — D1 finish ticketing

**Plan:** `.agents/plans/d1-finish-ticketing.md` · **Branch:** `claude/d1-ticketing-3fa7a0` → `dev`
**Reviews:** one per phase (separate agent, strongest model, read-only) + one fresh-context review of the whole branch before the PR. Phases 3 (config + pinned scripts) and 4 (staging seed) are small and were covered by the branch review.

## Phase 1 — admin auth (`993f9f2`)

Scope: `migrations/0010_create_admins.sql`, `src/lib/adminAuth.ts`, `src/pages/api/admin-login.ts`, `src/pages/api/admin/admins/{index,[id]}.ts`, `AdminsDashboard.tsx`, `.dev.vars.example`.
Reviewer verified the session logic with 24 cases (esbuild bundle + Node 22). Verdict: **pass with fixes**. No critical/high.

| # | Sev | Finding | Outcome |
|---|---|---|---|
| 1 | medium | `/api/admin-login` has no brute-force throttle; the env break-glass account is now the only way to the first superadmin | Not fixed in code (out of scope per plan). Julio: Cloudflare rate-limiting rule on `/api/admin-login`; long random `ADMIN_PASSWORD` (noted in `.dev.vars.example`) |
| 2 | medium | `/admin/login?next=` went straight to `window.location` (open redirect / `javascript:`) — pre-existing | Fixed: only `^/admin(/|$)` paths |
| 3 | low | Login timing revealed which emails are active D1 admins | Fixed: dummy PBKDF2 when no active row |
| 4 | low | Login: `null` body → 500; no payload cap | Fixed: 4 KB cap + object guard |
| 5 | low | Sessions survived a password change / `ADMIN_PASSWORD` rotation | Fixed: keyed credential fingerprint (`pv`) in the token, checked on every request; self password change re-issues the cookie |
| 6 | low | Password trimmed on PUT but not on POST/login | Fixed: never trimmed; whitespace-only rejected |
| 7 | low | Loose `role` / `is_active` coercion | Fixed: strict validation, 400 otherwise |
| 8 | low | React island imported the server auth module for a constant | Fixed: `src/lib/adminPolicy.ts` |

Evidence after fixes: 21/21 unit checks (`verifyAdminSession`/`createAdminSessionToken` under Node), 65/65 HTTP checks against `astro dev` (incl. all 26 method×route pairs of `/api/admin/*` → 401 without cookie, login without secret → 500 `not_configured`).

## Phase 2 — ticket money path (`0ac9214`)

Scope: `src/lib/tickets.ts`, `src/pages/api/tickets/{checkout,confirm}.ts`, `src/pages/api/bold-webhook.ts`, `src/lib/bold.ts`.
Reviewer simulated the issuance batch in `sqlite3` (fresh, loser, legacy-stuck, pending, UNIQUE rollback) and the cutoff at one-second steps. Verdict: **pass with fixes**. No critical/high.

| # | Sev | Finding | Outcome |
|---|---|---|---|
| 1 | medium | Confirm: a thrown voucher fetch (network error) still returned 500 and hid a paid buyer's tickets | Fixed: voucher failure → treated as "no answer", D1 decides |
| 2 | low | Race: webhook completes between issuance and read → `completed` with 0 tickets | Fixed: issue + re-read when completed with no tickets |
| 3 | low | Cutoff up to 60 s late for `event_date` with seconds | Fixed: "now" to the second |
| 4 | low | Repair could double-issue against an OLD-version instance during the deploy window | Not fixed (one round trip, needs webhook + confirm on different versions at deploy time). Release note: avoid deploying during a live sale |
| 5 | low | Webhook swallows issuance failure; token page never repaired | Fixed: `/entradas/<token>` repairs completed orders with no tickets |
| 6 | low | Reliance on per-statement `meta` of a D1 batch | Fixed: order id read back by `bold_order_id`; codes read back from D1 |
| 7 | low | Confirm now trusts D1 `completed` over a later voucher `VOIDED` | Intended ("D1 is the truth"); token page and check-in already did |
| 8 | low | `paymentsEnabled` defaulted to true | Fixed: required parameter |

Pre-existing, outside the diff: `confirmBoldOrder` promotes only `pending` rows, so a rejected order later approved on the same Bold order id would stay `rejected` (not verified that Bold allows that). Follow-up.

Evidence after fixes: 57/57 ticket/webhook/regression checks against `astro dev` + check-in (ok / already / not_found) + "no Bold keys → 500 before any insert, free events still work".

## Branch review (fresh context, `git diff origin/dev...HEAD` at `041b553`)

New agent, no prior context, read the whole branch (the July–October ticketing code plus this session's fixes). `npm run check` green. Verdict: **pass with fixes**. No critical/high. Fixed in `458ce20` unless noted.

| # | Sev | Finding | Origin | Outcome |
|---|---|---|---|---|
| 1 | medium | Attendee CSV export: formula injection from buyer fields (`=HYPERLINK(...)`) | pre-existing | Fixed: cells starting with `= + - @ tab CR` prefixed with `'` |
| 2 | medium | `/admin/checkin` imports the barcode ponyfill from esm.sh at runtime (no SRI possible; zxing wasm from a CDN) | pre-existing (pinned to 2.3.1 in `1f858c6`) | Not fixed: vendoring needs a new npm dependency → Julio's call (follow-up) |
| 3 | medium | `rejected` is terminal: a later approval on the same Bold order id leaves D1 `rejected`; confirm showed "completed" with no tickets | root pre-existing, shared with store/donations | Confirm part fixed (status now from D1, never "completed" without tickets). Promoting `rejected → completed` in `confirmBoldOrder` touches donations and the store: follow-up after checking whether Bold allows retries on the same order id |
| 4 | medium | Oversell window lasts the whole payment (pending orders reserve nothing) | pre-existing, documented as accepted in v1 | Product decision → Julio (follow-up) |
| 5 | medium | Public endpoints without abuse controls: free-event spam, pending-order spam, confirm calling Bold for any id | pre-existing | (c) fixed: strict id format, Bold queried only for existing pending orders. (a)(b): Cloudflare rate-limit rule / Turnstile → Julio (follow-up) |
| 6 | medium (verify) | Maps browser key in the public repo | key pre-existing (5516faa), duplicated into `previews` | Restrictions verified by Julio in O2 (Places API (New) only; afroin.org, *.afroin.org, *.workers.dev, localhost; 500/day) |
| 7 | medium (ops) | Production `admins` may still hold the old seeded account | operational | Julio handled the default password in O4; confirm the row is deleted once the first real superadmin exists |
| 8 | low | Paid amount not cross-checked against the voucher | pre-existing | Follow-up (relies on Bold's integrity-signature enforcement) |
| 9 | low | Event DELETE: R2 image deleted before an FK-failing row delete; any R2 key deletable | pre-existing | Fixed |
| 10 | low | Rule 5: hard-coded Spanish on public pages ("Entrada Libre", "Reservar Entradas", `ENTRADA`, aria-labels, API error messages) | pre-existing (in production) | Not fixed: buyer-visible copy → Julio (follow-up) |
| 11 | low | `event_date` not validated | pre-existing | Fixed |
| 12 | low | `.dev.vars.example` default admin password; PATCH null → 500; no `no-store` on bearer pages; blocked sessionStorage breaks checkout | mixed | Fixed |
| 12 | low | Sitemap lists `/admin/*` and receipt pages; self password change without current password; ambiguous login lookup; UI minimum 1,500 COP vs server 1,000; JSON-LD `</script>` escaping (latent) | pre-existing | Follow-up (sitemap lives in `astro.config.mjs`, which D5 owns next) |
| — | info | SRI hash of `qrcode-generator@1.4.4` not verified by the reviewer | — | Verified: hash computed from the CDN file; QR renders in the browser with `integrity` set, no console errors |

Evidence after fixes: auth 65/65, tickets/webhook/regression 57/57, review-fix checks 15/15 against `astro dev`; `npm run check` green.
