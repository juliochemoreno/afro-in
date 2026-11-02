# Code review: D26 — door for phones, checkin host, PWA, door role

- **Range:** `9f86915..3b70c4d` (origin/dev → phase 4), excluding `.agents/`
- **Reviewer:** fresh-context agent (read-only), 2026-11-01
- **Result:** 0 critical, 1 high, 5 medium, 4 low. All fixed except M5 (mitigated by the release order), L1 (Julio's redirect rule), L3 and the logout half of L4 (follow-ups).

## High

### H1. `/%61dmin/...` bypassed the admin guard (pre-existing) — FIXED
`src/middleware.ts`: the guard compared the raw `url.pathname`, while Astro routes on `decodeURI(pathname)`. `GET /%61dmin/donadores` rendered the page without a session (reproduced on `astro dev`: 200). Not introduced by D26, but it also bypassed the door-role restriction. Production may or may not normalise the escape at the edge (not checked).
**Fix:** the middleware decodes the path once (`decodeURI`, 400 on a malformed escape) and uses it for every check. Verified: `/%61dmin/donadores` → 302 login; with a door session `/%61dmin/pedidos` → 302 door.

## Medium

### M1. Offline page possibly cached as a redirected response — FIXED
`public/checkin-sw.js`: Workers Assets' default `auto-trailing-slash` may redirect `/checkin-offline.html`; a redirected cached response cannot answer a navigation. **Fix:** precache rebuilds each response as a fresh 200. Offline fallback still to be seen on the phone test.

### M2. An expired door account could not be edited — FIXED
`src/pages/api/admin/admins/[id].ts`: the unchanged past date was re-validated on every PUT. **Fix:** only a changed date must be today or later. Verified: renaming an expired door account → `{"ok":true}`.

### M3. `start()` could run twice; `stop()` did not stop the scan loop — FIXED
`src/components/CheckinScanner.tsx`: guard (`startingRef` + disabled "Abriendo…" button), the loop's timeout id kept and cleared, `runningRef` stops rescheduling.

### M4. No recovery after the phone locks / the app goes to the background — FIXED
Same file: `track.onended` and `visibilitychange` (hidden) call `stop()`, so the start button comes back instead of a frozen frame.

### M5. The code fails closed for every D1 admin without migration 0015 — ACCEPTED
`verifyAdminSession` selects `active_until`. Kept as is (fail closed is the safe direction); the release order is item O9 (0) in the work list, first in the plan's production steps, and in the PR body. Staging and local D1 must get 0015 before a Preview is used.

## Low

- **L1.** `https://checkin.afroin.org/` serves the static home (assets before the Worker). Known in the plan: Julio's redirect rule (production step 2).
- **L2.** An unrecognised role in D1 became a full admin, and `accountActive` compared the raw string — FIXED: `parseRole` trims and lower-cases; `accountActive` uses it (tests added).
- **L3.** SW cache grows with each deploy; the esm.sh QR ponyfill is not cached for iPhone — follow-up (bump `CACHE` per release or prune; self-host the ponyfill).
- **L4.** Manual double tap could send the same code twice — FIXED (busy/verdict check + debounce stamp). Logout is a GET (pre-existing, CSRF logout) — follow-up.

## Checked with no finding
Door path tricks (dot segments, encoded door paths, case, `.html`, double slashes); every `/api/admin` handler calls `requireAdmin` and only check-in passes `allowDoor` (also enforced by `tests/door-access.test.ts`); sessions re-read role and expiry from D1; login timing for expired/inactive/unknown accounts; role changes only by superadmins; SW caches no HTML or API responses; auto-dismiss and debounce timers.
