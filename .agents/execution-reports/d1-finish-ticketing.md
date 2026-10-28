# Execution Report — D1 Finish event ticketing

## Meta Information

- **Plan:** `.agents/plans/d1-finish-ticketing.md`
- **Branch:** `claude/d1-ticketing-3fa7a0` (from `feature/event-ticketing` 5516faa, `origin/dev` merged in 2eb681a, no rebase)
- **PR:** to `dev` (URL in the PR list; opened right after this report)
- **Commits (this session):** 2eb681a (merge `origin/dev`), 8e121bb (plan), 993f9f2 (admin auth), 0ac9214 (ticket money path), 1f858c6 (Preview vars + pinned scripts), 041b553 (staging seed), 458ce20 (branch review fixes), 21dc6ca (code review doc), 10a5721 (store return routing), 4b97f4d (report/plan/review), plus the Level 5 notes commit
- **Carried commits (code production runs since the 2026-10-06 manual deploy):** 7ac05bd, b073bde, c2d4309, ecc0833, 5516faa
- **Files added this session:** `migrations/0010_create_admins.sql` (credential-free), `src/lib/adminPolicy.ts`, `.agents/plans/d1-finish-ticketing.md`, `.agents/code-reviews/d1-finish-ticketing.md`, this report
- **Staging (pre-approved):** D1 `afroin-preview` migrated 0008–0010 + `seeds/preview.sql` ticketing rows. Previews base config and Preview `claude-d1-ticketing-3fa7a0`: `ADMIN_SESSION_SECRET` (random, piped, never shown; Julio's OK)
- **Production:** one read-only schema query with Julio's OK (O4). Nothing written.

## Validation Results

- Syntax & Linting: Not applicable (no linter)
- Type Checking: ✓ `npm run check` (astro build + tsc + wrangler dry-run) after every phase and after every fix
- Unit Tests: Not applicable (no framework). Session logic checked with 21 Node cases over `src/lib/adminAuth.ts` (scratch script, not committed)
- Integration Tests (curl against `astro dev` + local D1): ✓ auth 65/65 (incl. all 26 method×route pairs of `/api/admin/*` → 401 without cookie; login without `ADMIN_SESSION_SECRET` → 500 `not_configured`); tickets/webhook/regression 57/57; review-fix checks 15/15; store-return fix 8/8 endpoint checks with real Bold-test-APPROVED ids + 6 browser routing cases (es/en/fr) where `/pedido` now completes its own confirmation
- Level 5 (Julio; verified by the agent in staging/local D1 and Workers logs):
  - Branch Preview: Bold TEST ticket purchase completed and issued exactly 1 ticket ✓; iPhone camera scan ✓; duplicate scan ⚠ ✓; manual code (`DEV0000001`) ✓; sold-out ✓ (curl + page).
  - Store fix, browser flow (local `astro dev` in this worktree, Julio's Chrome, Bold TEST card, no manual confirm, no "Probar el webhook"): store order #10 lands on `/pedido` "¡Gracias por tu compra!" and is `completed`/`APPROVED`; donation #10 lands on `/gracias` and is `completed`/`APPROVED`.
  - Android scan: **descartada** — sin Android disponible, 2026-10-27; escaneo con cámara probado en iPhone y código manual probado. Tracked by the orchestrator as a pending check.

## Code Review Findings

- **Code review file:** `.agents/code-reviews/d1-finish-ticketing.md`
- **Reviews:** phase 1, phase 2, fresh-context whole branch, store-return fix (each by a separate read-only agent)
- **Issues found:** 0 critical, 0 high; mediums and lows listed per review
- **Fixed in the branch:** 25+ (open redirect in `/admin/login`, timing and payload hardening, revocation on password change, strict validation, confirm on Bold outage, cutoff to the second, token-page repair, CSV formula injection, confirm amplification, event delete order, `event_date` validation, bearer-page headers, sessionStorage robustness)
- **Left for Julio / follow-ups:** login and public-endpoint rate limiting (Cloudflare rule), esm.sh ponyfill on `/admin/checkin` (vendoring needs a dependency), seat reservation during payment, en/fr copy hard-coded in Spanish, `rejected → completed` promotion in `confirmBoldOrder`

## What Went Well

- The repo's history made the security findings cheap to verify: `git log --all -S` proved the default password never left the local stash.
- D1 `batch()` (one transaction) turned ticket issuance into all-or-nothing with no schema change, and the same batch repairs orders an older version left claimed with zero tickets.
- Workers observability (`/workers/observability/telemetry/query` with the AFRO IN token) answered the Level 5 questions the D1 rows could not: which device scanned, and that `/api/store/confirm` was `canceled` by a navigation.

## Challenges Encountered

- Level 5 needs Julio's phones and payment/credential steps on a non-local host; the agent prepared data, URLs and checks and verified results in D1 and logs.
- The first Level 5 donation and store purchase ran on `dev.afroin.org` (shared staging D1), not on the branch Preview; the logs showed it.

## Bugs Encountered

**Store orders never confirmed by the browser — pre-existing in production since June 2026**

- **Symptom:** staging store order 1 stayed `pending` although Bold had it `APPROVED`.
- **Root cause:** the global Bold return handler in `src/layouts/Layout.astro` (33f5c7a, June) redirected every `?bold-order-id=` page except `/gracias` to `/gracias`. On `/pedido` that navigation cancelled `/api/store/confirm` (Workers `outcome: canceled`, 250 ms), and `/api/bold-confirmar` on `/gracias` only updated `donors`. Production store orders were completed only by the webhook, and buyers saw the donation thank-you page instead of their receipt.
- **Fix:** route returns by prefix (`AFROIN-TIX-` → `/entradas`, `AFROIN-ORD-` → `/pedido`, donations → `/gracias`); `/api/bold-confirmar` picks its table through `CONFIRM_TARGETS` and refuses ticket ids. Approved by Julio ("Si, hay que corregir el fallo de la tienda").
- **Severity:** Medium (money was taken; confirmation depended on the webhook alone).

**Ticket issuance could leave a paid order with zero tickets (code in production)** — claim then insert in two steps; fixed with one batch + repair (phase 2).

**Sales closed 5 h early (code in production)** — zone-less Colombia time compared with UTC; fixed with Julio's OK.

## Divergences from Plan

**Store return routing fixed in this PR**

- **Planned:** not in the plan (store flow was only a Level 5 regression).
- **Actual:** fixed `Layout.astro` handler + `/api/bold-confirmar` routing.
- **Reason:** Level 5 found the pre-existing bug; Julio chose to fix it here.
- **Type:** Other (scope addition approved by Julio)

**Phases 3 and 4 reviewed in the branch review**

- **Planned:** a code review per phase.
- **Actual:** phases 3 (config, pinned scripts) and 4 (seed) were covered by the fresh-context branch review.
- **Reason:** both are a few lines of config/data.
- **Type:** Better approach found

**Review fixes beyond the plan's tasks**

- **Planned:** 11 tasks.
- **Actual:** plus the review fixes listed above (two commits).
- **Reason:** code review findings on a money path.
- **Type:** Other

## Scope Assessment

- **Planned tasks:** 11 · **Executed:** 11
- **Unplanned additions:** review fixes (≈ 20 small items), store-return bug fix, `ADMIN_SESSION_SECRET` on staging
- **Scope accuracy:** Under-scoped — the inherited code needed more hardening than the two known findings.

## Skipped Items

- Login / public endpoint rate limiting: Cloudflare dashboard rule, Julio.
- Vendoring the barcode ponyfill: new dependency, Julio's call.
- Rule 5 copy for free events and API errors in en/fr: buyer-visible text, Julio's call.
- Sitemap exclusions: `astro.config.mjs` is D5's next.

## Technical Patterns Discovered

- **Pattern/Gotcha:** a client-side redirect right after an island starts a `fetch` cancels the Worker invocation (`outcome: canceled`) before it writes to D1.
  - **Where it applies:** any page that confirms a payment from the browser.
  - **Ready-to-paste entry** (orchestrator.md, project rules): `Payment receipt pages confirm from the browser: never navigate away from a page while its confirm request is in flight (the Worker is cancelled with the request). The Bold return handler in Layout.astro routes by order-id prefix.`
- **Pattern/Gotcha:** Workers observability is queryable with the AFRO IN token: `POST /accounts/$CLOUDFLARE_ACCOUNT_ID/workers/observability/telemetry/query` (`view: "events"`, filters on `$workers.scriptName` and `$workers.event.request.url`). Shows device (user-agent), status and outcome per request.
- **Pattern/Gotcha:** Bold sandbox sends no webhook for payment-button transactions unless "Probar el webhook" is used, and the test webhook URL in the Bold panel points at the `dev` Preview only.
- **Pattern/Gotcha:** production D1 has a `d1_migrations` table (contradicts `orchestrator.md`); rows not read.

## Recommendations

- Plan command improvements: for inherited code, plan a fresh-context review BEFORE writing tasks; most work came from it.
- Execute command improvements: Level 5 instructions should name the exact host (branch Preview vs `dev.afroin.org`) on every step.
- Release (Julio): set `ADMIN_SESSION_SECRET` in production before merging to `main`; no production migration needed; avoid deploying while a ticket sale is live (old/new version overlap during issuance).
