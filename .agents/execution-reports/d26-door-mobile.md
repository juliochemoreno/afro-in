# Execution Report: D26 — Door for phones, checkin.afroin.org, PWA, door-only role

## Meta Information

- **Plan:** `d26-door-mobile` — `.agents/plans/done/d26-door-mobile.md`
- **PR:** [PR #29](https://github.com/juliochemoreno/afro-in/pull/29), merged into `dev` as 5451ab8
- **Commits:** 7d075cf (plan), 65e34a6 (door host + login), cc602e8 (phone door), 78310b4 (PWA), 3b70c4d (door role + 0015), 56a004b (review fixes + docs), a550688 (results stay until "Siguiente"), b885c64 (smaller, explanatory result texts), e3042b0 (gh account rule)
- **Files added:**
  - `src/lib/doorHost.ts`, `src/lib/doorVerdict.ts`, `src/lib/adminRoles.ts`
  - `src/layouts/DoorLayout.astro`
  - `migrations/0015_add_admin_active_until.sql`
  - `public/checkin.webmanifest`, `public/checkin-sw.js`, `public/checkin-offline.html`, `public/icons/checkin-{180,192,512,maskable-512}.png`
  - `tests/door-host.test.ts`, `tests/door-verdict.test.ts`, `tests/admin-roles.test.ts`, `tests/door-access.test.ts`
  - `.agents/plans/d26-door-mobile.md`, `.agents/code-reviews/d26-door-mobile.md`
- **Files modified:** `src/components/CheckinScanner.tsx`, `src/pages/admin/checkin.astro`, `src/pages/admin/login.astro`, `src/middleware.ts`, `src/env.d.ts`, `src/lib/adminAuth.ts`, `src/pages/api/admin-login.ts`, `src/pages/api/admin/checkin.ts`, `src/pages/api/admin/admins/index.ts`, `src/pages/api/admin/admins/[id].ts`, `src/components/admin/AdminsDashboard.tsx`, `public/_headers`, `.agents/orchestrator.md`, `.agents/plans/2026-10-27-work-list.md`
- **Lines changed:** +1624 −240 (+1247 −240 without `.agents/`)
- **Remote changes:** staging D1 got 0014 + 0015 and two test tickets (`DEV0000002` out of range, `DEV0000003` unpaid); Preview `checkin-d26` deployed.

## Validation Results

- Syntax & Linting: not applicable (no lint script).
- Type Checking: ✓ `npx tsc --noEmit` on b885c64; `npm run check` exit 0 on 3b70c4d and 56a004b.
- Unit Tests: ✓ 120 passed, 0 failed (16 new across 4 files).
- Integration Tests: ✓ curl matrix on `astro dev` (port 4331, local D1, local-only test users): door host routing; a door session gets 14 pages → door, 16 other APIs → 401, check-in 200; expiry ends an open session and blocks login; superadmin create / edit / delete of door users. Preview `checkin-d26.afroin.org`: door routing, noindex, 401 on bad login, `/%61dmin/…` → door.
- Human (Level 5): ✓ Julio, local ("Okay parece que todo está en orden") and phone ("Todo bien") with one QR per result case.

## Code Review Findings

- **Code review file:** `.agents/code-reviews/d26-door-mobile.md` (fresh-context agent)
- **Issues found:** 0 critical, 1 high, 5 medium, 4 low
- **Issues fixed before this report:** 7 (H1, M1–M4, L2, half of L4)
- **Key findings:** the admin guard compared the raw path while Astro routes on the decoded one, so `/%61dmin/donadores` rendered without a session (pre-existing, reproduced locally; fixed by decoding in the middleware). The service worker's offline page was stored as a redirected response (confirmed on the Preview: `.html` → 307).

## What Went Well

- Julio settled every product decision one at a time (subdomain name, result behaviour, door in the admin, expiry, any event, name only, superadmin only).
- Deny-by-default in `requireAdmin` meant 16 API files refuse door users without being edited; `tests/door-access.test.ts` walks the real route files, so a new admin route changes the counts and forces a look.
- Host-only cookies gave the subdomain its own session with no auth change.
- The phone test ran on a Preview named `checkin-<x>`, which behaves as the door host with staging data.

## Challenges Encountered

- Prerendered pages are static assets served before the Worker, so the middleware cannot redirect `checkin.afroin.org/`; it needs a Cloudflare redirect rule (Julio's step).
- Staging D1 had neither 0014 nor 0015, so D25's multi-day check-in could not have worked on `dev.afroin.org`.
- `DEV0000001` had been used on 2026-10-28, which made the first phone scan amber; one QR per case needed two new staging tickets.
- `sips` kept transparency in the icons (black on iOS); ImageMagick, already on the Mac, flattened them.
- The Astro dev toolbar sits over the bottom of the door screen in `astro dev`, which made clicks in browser checks miss.

## Bugs Encountered

| Bug | Category | Found By | Severity |
|-----|----------|----------|----------|
| `/%61dmin/...` bypassed the admin guard (pre-existing) | validation | code review | high |
| Offline page cached as a redirected response | other | code review | medium |
| Expired door account could not be edited | validation | code review | medium |
| Camera could start twice; scan loop survived `stop()` | race condition | code review | medium |
| Frozen camera after the phone locks | other | code review | medium |
| Hand-edited role (`"Door "`) escaped expiry | validation | code review | low |
| Manual double tap could send a code twice | race condition | code review | low |
| Icons with transparent areas | styling | manual testing | low |

## Divergences from Plan

**Results stay until "Siguiente"**
- **Planned:** back to the camera after ~2.5 s, tap to close sooner (Julio's first choice).
- **Actual:** the result stays until the staff taps "Siguiente".
- **Reason:** Julio's request after his local test.
- **Type:** Other (product decision changed)

**Explanatory result texts**
- **Planned:** big title (attendee name or state) and one detail line.
- **Actual:** smaller title ("Puede entrar", "Ya entró hoy", …), the attendee and event or time, and a line on what to do.
- **Reason:** Julio: texts too big and too basic.
- **Type:** Other (UX iteration, within the budget of 3)

**Allow list lives in `doorHost.ts`**
- **Planned:** `isDoorPath` in `adminRoles.ts`, reused by `doorHost.ts`.
- **Actual:** in `doorHost.ts`, imported by the middleware and the access test.
- **Reason:** it already existed there from phase A; one list either way.
- **Type:** Better approach found

**Production verification step 3**
- **Planned:** compare `/api/contador` on both hosts.
- **Actual:** compare the `/_astro/` asset names of `/admin/login`.
- **Reason:** the door host answers `/api/contador` with 404.
- **Type:** Plan assumption wrong

**Icons with ImageMagick, not `sips`**
- **Planned:** `sips` only.
- **Actual:** ImageMagick (already installed, not a project dependency).
- **Reason:** `sips` kept alpha.
- **Type:** Plan assumption wrong

## Scope Assessment

- **Planned tasks:** 18 (+ docs task)
- **Executed tasks:** 18 + docs
- **Unplanned additions:** 4 — H1 guard fix (pre-existing security bug); staging 0014 + test tickets; QR sheet per case for the phone test; gh account rule (PRs were opened as `juliohopla`, emailing julio@hopla.tools).
- **Scope accuracy:** On target (the door role was added to the plan before execution).

## Skipped Items

- Code review M5 (fail closed without 0015) — Reason: accepted; release order is O9 step (0).
- L1 (door host root shows the home) — Reason: Julio's redirect rule (O9).
- L3 (SW cache growth; esm.sh ponyfill not cached) and logout-as-GET — Reason: follow-ups.
- Production steps — Reason: Julio's (O9).

## Technical Patterns Discovered

- **Pattern/Gotcha:** Astro matches routes on `decodeURI(pathname)`; middleware path checks on the raw `url.pathname` can be bypassed with percent-escapes.
  - **Where it applies:** any middleware guard or allow list on paths.
  - **Ready-to-paste AGENTS.md entry:** `- Middleware path checks use the decoded path (decodeURI(url.pathname), 400 on a malformed escape), never the raw url.pathname. *Why: Astro routes on the decoded path; /%61dmin/... rendered admin pages without a session until D26.*`
- **Pattern/Gotcha:** static (prerendered) pages never reach the middleware on Workers; host-based routing for them needs a Cloudflare rule.
  - **Where it applies:** subdomains or hosts that should hide public pages.
  - **Ready-to-paste AGENTS.md entry:** `- Host-based routing in the middleware covers SSR routes only: prerendered pages (e.g. "/") are served as static assets before the Worker. Redirect them with a Cloudflare redirect rule (D26: checkin.afroin.org/).`
- **Pattern/Gotcha:** Workers Assets redirects `/x.html` to `/x` (307); a service worker must not answer navigations with that redirected response.
  - **Where it applies:** service workers that precache static HTML.
  - **Ready-to-paste AGENTS.md entry:** `- A service worker that precaches static HTML re-wraps each response as new Response(body, {status: 200}): Workers Assets redirects /x.html to /x, and a redirected cached response cannot answer a navigation.`
- **Pattern/Gotcha:** this Mac's active `gh` account is `juliohopla`.
  - **Where it applies:** any `gh` command in afro-in.
  - **Ready-to-paste AGENTS.md entry:** already rule 12 in `.agents/orchestrator.md` (e3042b0).

## Recommendations

- Plan command improvements: when a plan adds a role or guard, include the encoded-path case in the access test from the start.
- Execute command improvements: before a Level 5 on staging, list the test tickets and their state (`DEV0000001` was already used) and hand Julio one QR per case.
- AGENTS.md / CLAUDE.md additions: the three entries above.
