# Plan: D26 — Door check-in for phones, on checkin.afroin.org, installable

## Overview
The door scanner (`/admin/checkin`) becomes a full-screen, phone-first screen: the camera fills the screen and each scan answers with a full-screen green, amber or red result, a sound and a vibration, then returns to the camera by itself. The same screen is served on its own host, `checkin.afroin.org`, which shows only the door behind the existing admin login, and it can be installed on the phone as an app (PWA).

## Requirements Summary
- Mobile-first door screen (Julio: "debe ser más atractiva para móvil"):
  - full screen, camera as the centre; manual code entry kept as fallback;
  - full-screen result using D25's states: green "Válida · día X de N" (or the event name for a one-day ticket), amber "Ya entró hoy" / "Ya usada", red "Fuera de fechas" / "No encontrada" / "Pago no confirmado" / "Error de red";
  - short sound and vibration per result; **the result returns to the camera by itself after ~2.5 s, a tap closes it sooner** (Julio, 2026-11-01);
  - **the same full-screen door on `afroin.org/admin/checkin`, with a ✕ back to the admin panel; on `checkin.afroin.org` there is no way out to the admin** (Julio, 2026-11-01).
- Subdomain **`checkin.afroin.org`** (Julio, 2026-11-01) shows only the door, behind the existing admin login, without weakening auth.
- PWA: manifest with the AFRO IN icon, standalone display, a minimal service worker for the app shell. **No offline validation in v1: every scan hits the server.**
- **Door-only user role** (Julio, relayed by the orchestrator 2026-11-01: "hay que crear un tipo de usuario para que pueda encargarse del checkin, y no tenga acceso a otras cosas, por ejemplo para contratar a alguien ese día"):
  - role `door` ("Puerta"): can log in and use only the door screen and the check-in API; every other admin page and admin API refuses it **on the server**;
  - **expires automatically**: required "Activo hasta" date; after that door day (rolls over at 06:00 Bogotá, as D25) it can neither log in nor keep using an open session (Julio);
  - **not tied to an event**: validates any event (Julio);
  - **sees only the attendee's name** on a scan, never email or phone — as today, the check-in API returns no contact data (Julio);
  - **only superadmins** create, edit, disable and delete door users, in Ajustes → Administradores, as for every account today (Julio);
  - additive migration `0015` (new nullable column); Julio applies it in production himself, **before** the release.
- No new dependencies. Design: dark #161616, cream #f3e9d2, gold #e6b84a, red #d0342c; Anton for display, Outfit for body; square buttons; no gold boxed frames; no repeated info.
- Workflow classification: **async data-arrival** for the camera loop (frames → detector → one POST per new code, as today); **sequential user-driven** for manual entry (submit handler) and for dismissing a result (timer or tap, no effect chains).

## Out of Scope
- Offline validation or a local ticket list (scans always go to the server; with no network the screen shows "Error de red").
- Any change to check-in rules, the API response or the database (D25 owns them; no migration).
- Door users tied to one event; door users seeing buyer email/phone; door users changing their own password (they are refused by every admin API but check-in; a superadmin resets it).
- Admins (non-super) managing door users.
- Keeping the screen awake (Wake Lock), torch/flash control, a scan history list, door statistics.
- Applying the Cloudflare domain and redirect rule: production config, Julio's steps (below).
- Hiding the public prerendered pages on `checkin.afroin.org`: static files are served before the Worker runs (see Gotchas); they stay reachable there, with `noindex`, and nothing links to them.
- **Expected UX iterations: 3** (new full-screen screen, result overlay, login look on the door host).

## Likely Follow-ups
- Keep the screen awake while scanning (Wake Lock API).
- Torch toggle for dark doors.
- Door users tied to one event ("Otro evento" in red).
- An activity log of which door user scanned what.
- O7 (Android camera scan) closes with this work's phone test if an Android is at hand.

## Git Strategy
- **Base branch:** `dev`
- **Feature branch:** `claude/d26-door-mobile-74cfc9` (this worktree's branch; one branch, one PR to `dev`)

## Context References
Verified while planning (2026-11-01, worktree at 9f86915):
- `src/components/CheckinScanner.tsx` — current scanner (whole file, 330 lines): `getDetector()` (native `BarcodeDetector`, else `https://esm.sh/barcode-detector@2.3.1/pure` ponyfill — keep it as is), ~5 fps `tick` loop, 3 s same-code debounce, `submitCode` POSTs `{ code }` to `/api/admin/checkin`, `verdictCard()` maps results to cards, `formatTime` / `formatDay` helpers. Local `Verdict` type mirrors `CheckInResult`.
- `src/lib/tickets.ts:846-865` — `CheckInResult`: `ok {attendee, eventName, day?, days?}`, `already {attendee, eventName, checkedInAt, today?}`, `out_of_range {attendee, eventName, startDate, endDate}`, `not_found`, `not_paid`. The client adds `error` for network/non-200.
- `src/pages/api/admin/checkin.ts` — POST, `requireAdmin` → 401, body `{ code }` trimmed to 40 chars, 400 on bad JSON/empty code, else 200 with `CheckInResult`. **No change needed**: same-origin `fetch` on either host sends the host's own cookie.
- `src/pages/admin/checkin.astro` — wraps the scanner in `AdminLayout`; `prerender = false`.
- `src/lib/adminAuth.ts:174-186` — `setAdminSessionCookie`: `httpOnly`, `secure` on https, `sameSite: "lax"`, `path: "/"`, **no `Domain`** → host-only cookie. On `checkin.afroin.org` a login sets a cookie for that host only. `requireAdmin` / `verifyAdminSession` re-read the admin from D1 on every request. **No auth code change.**
- `src/pages/api/admin-login.ts`, `src/pages/api/admin-logout.ts` — login sets the cookie via `setAdminSessionCookie(cookies, token, request.url)`; logout deletes it (`path: "/"`) and redirects to `/admin/login`.
- `src/pages/admin/login.astro` — uses the public `Layout` (site header/footer); redirects an authed visitor to `/admin/donadores`; `next` defaults to `/admin/donadores` and only accepts `/admin…` paths.
- `src/middleware.ts` — `sequence(noindexOutsideProduction, handleRequest)`; `handleRequest`: (0) `/admin*` except `/admin/login` needs a valid session else 302 `/admin/login?next=…`; (1) www → non-www; (2) http → https except hosts containing `localhost`/`127.0.0.1`; (3) language detection on `/`. `PRODUCTION_HOSTS = {afroin.org, www.afroin.org}`: every other host, `checkin.afroin.org` included, gets `X-Robots-Tag: noindex` on SSR responses.
- `public/_headers` — `https://:sub.afroin.org/*` → `X-Robots-Tag: noindex` for static files on every subdomain (checkin included) except www.
- `src/layouts/AdminLayout.astro` — mobile top bar already has a "Puerta" shortcut to `/admin/checkin`; sidebar item "Puerta". **No change needed**: the link now opens the full-screen door, whose ✕ returns to `/admin`.
- `src/components/FestivalFont.astro` (Anton, Google Fonts, `media="print"` swap) and `src/layouts/Layout.astro:226-232` (Outfit from Google Fonts) — loading pattern to copy.
- `src/assets/img/logos/afroin.png` — 652×307, red logo; source for the app icons (generated with macOS `sips`, no dependency).
- `tests/door-day.test.ts` — test style: `node:test` + `node:assert/strict`, imports `../src/lib/<file>.ts` (pure modules without `@/` imports). Run by `npm test`.
- `seeds/preview.sql:16-17` — staging has a paid one-day ticket `DEV0000001` (used for the phone test).
- `wrangler.json` — no `routes`: custom domains live in the dashboard. `afroin.org` is "Production and Preview", so every Preview is also `<preview-name>.afroin.org` (wildcard `*.afroin.org`) (`.agents/plans/2026-10-27-work-list.md`, Production state).
- Static assets before the Worker: `node_modules/@astrojs/cloudflare/dist/utils/handler.js:11-51` falls back to `env.ASSETS.fetch` for routes that are not SSR, and Workers static assets are matched before the Worker by default. `src/pages/index.astro` has no `prerender = false`, so `/` is a static file: **middleware cannot redirect `checkin.afroin.org/`** → a Cloudflare redirect rule (Julio's step) does it.
- Cloudflare docs (`/workers/previews/custom-domains/`): "Use a dedicated hostname … if your production domain already has subdomains. This avoids wildcard conflicts." They do not state whether a production custom domain `checkin.afroin.org` wins over the Preview wildcard `*.afroin.org` → **unverified; Julio's step 3 verifies it** before anyone relies on the host.

Door role (verified 2026-11-01):
- `migrations/0010_create_admins.sql` — `role TEXT NOT NULL DEFAULT 'admin'` with **no CHECK constraint** → `'door'` needs no schema change; only the expiry needs a column. Latest migration is `0014`; next is `0015`.
- `src/lib/adminAuth.ts` `verifyAdminSession` — maps `row.role === "superadmin" ? "superadmin" : "admin"`: **a `door` row would become `admin` today** — must change. `AdminUser.role` type is `"superadmin" | "admin"`. `requireAdmin(ctx)` is the single guard of every admin API.
- `grep -rln "requireAdmin" src/pages` → 17 files, exactly every file under `src/pages/api/admin/` (17): `admins/[id].ts`, `admins/index.ts`, `checkin.ts`, `events/[id].ts`, `events/index.ts`, `events/upload.ts`, `orders/[id].ts`, `orders/index.ts`, `products/[id].ts`, `products/index.ts`, `products/upload.ts`, `taxonomy/[type]/[id].ts`, `taxonomy/[type]/index.ts`, `tickets/[id].ts`, `tickets/[id]/email.ts`, `tickets/courtesy.ts`, `tickets/index.ts`.
- `find src/pages/admin -type f` → 15 pages: `administradores`, `atributos`, `checkin`, `donadores`, `entradas`, `eventos`, `eventos/[id]/entradas`, `eventos/[id]/index`, `eventos/nuevo`, `index`, `login`, `pedidos`, `productos`, `productos/[id]`, `productos/nuevo`. All but `login` are guarded only by the middleware step (0) (`isValidAdminSession`, boolean, no role).
- `grep -rln "isValidAdminSession\|verifyAdminSession\|ADMIN_COOKIE" src` → `adminAuth.ts`, `middleware.ts`, `admin/login.astro`, `api/admin-logout.ts`. No other auth path.
- `src/pages/api/admin/admins/index.ts` — POST superadmin-only, accepts role `admin|superadmin` (400 otherwise), GET lists `id, email, name, role, is_active, created_at, updated_at`. `admins/[id].ts` — PUT: superadmin edits anyone, others only themselves (name/password, never role/status); DELETE superadmin-only, not self.
- `src/pages/api/admin-login.ts` — D1 lookup selects `id, email, name, password_hash, salt, role, is_active`; checks `is_active === 1`.
- `src/components/admin/AdminsDashboard.tsx` (520 lines) — ag-grid list with a "Rol" badge (Superadmin / Admin) at ~l.213, form with a `<select id="admin-role">` (admin, superadmin) at ~l.423.
- `src/pages/api/admin/checkin.ts` → `checkInTicket` returns only `attendee`, `eventName`, times/dates — no email or phone (`src/lib/tickets.ts:846-865`).

Dependents search: `grep -rn "admin/checkin\|CheckinScanner" src` → `AdminLayout.astro` (2 links), `checkin.astro`, `CheckinScanner.tsx`. No test references the scanner.

## Domain Assumptions
Confirm or correct each before execution:
- Colours: green = `ok`; amber = `already` (today or a one-day ticket already used); red = `out_of_range`, `not_found`, `not_paid`, `error`.
- Green shows the attendee's name big and, below, "Válida · día X de N" (multi-day) or the event name (one day). Amber shows "Ya entró hoy" / "Ya usada" big with name and time. Red shows the state big and, when known, the name and the pass dates.
- Sound and vibration: a short high beep for green, two mid beeps for amber, one low long tone for red; vibration patterns to match. A mute button in the door bar, remembered on the phone. iPhone Safari does not vibrate (browser limit); sound works after the first tap ("Iniciar cámara").
- The camera starts with one big tap ("Iniciar cámara"), not by itself: phones require a gesture for sound, and it avoids a camera prompt on every open.
- Door bar (top, small): AFRO IN logo, the count of valid entries in this session, mute, manual entry, "Salir" (logout), and the ✕ to the admin (only on afroin.org and only for superadmin/admin). No other text.
- A door user whose "Activo hasta" is 17 ene 2027 can work the night of the 17th until 06:00 on the 18th (door-day rule), then is logged out on the next request and cannot log in again.
- A refused door user on an admin page lands on the door; on any other admin API gets 401 `{ error: "unauthorized" }` (same as no session; no hint about what exists).
- In Administradores, door users show a "Puerta" badge and their "Activo hasta" date, with "Vencido" once past.
- Any active admin can log in on `checkin.afroin.org`; it needs its own login there once (8 h session, like today).
- On `checkin.afroin.org`, every other admin page redirects to the door and every other API answers 404.

## Implementation Tasks

> All fields are required.

### Phase A — Door host

### Task 1: Add the door-host rules as a pure module
- **Action:** create
- **File:** `src/lib/doorHost.ts`
- **Pattern:** `src/lib/doorDay.ts` (pure, no `@/` imports, comment header)
- **Details:**
  - `isDoorHost(hostname: string): boolean` — true when the first DNS label is `checkin` or starts with `checkin-` (lower-cased): `checkin.afroin.org`, `checkin.localhost`, a Preview named `checkin-<x>` (`checkin-<x>.afroin.org`, `checkin-<x>-afro-in.afroinsantamarta.workers.dev`). False for `afroin.org`, `www.afroin.org`, `dev.afroin.org`, `localhost`, `mycheckin.afroin.org`.
  - `DOOR_PATH = "/admin/checkin"`.
  - `doorHostRoute(pathname: string): "allow" | "door" | "not_found"` — `allow` for `/admin/checkin`, `/admin/login`, `/api/admin-login`, `/api/admin-logout`, `/api/admin/checkin` (each with or without a trailing slash); `not_found` for any other `/api/…`; `door` (redirect to the door) for everything else.
- **Gotcha:** the rule only ever restricts the door host; it must never grant anything. Do not match `checkin` anywhere but the first label.
- **Validate:** `node --experimental-strip-types --test tests/door-host.test.ts`

### Task 2: Route the door host in the middleware
- **Action:** modify
- **File:** `src/middleware.ts`
- **Pattern:** the existing step (0) in `handleRequest`
- **Details:** add a step before (0): when `isDoorHost(url.hostname)`, `doorHostRoute(pathname)` → `door`: `context.redirect(DOOR_PATH, 302)`; `not_found`: `new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "Content-Type": "application/json" } })`; `allow`: continue to the normal steps (auth, https). Import from `./lib/doorHost` (relative, like `./lib/adminAuth`).
- **Gotcha:** keep `noindexOutsideProduction` outermost (it already covers the door host). The language step on `/` never runs on the door host (it is redirected first, or `/` is a static file in production anyway).
- **Validate:** curl matrix in Level 4 (door host and main host).

### Task 3: Login page on the door host
- **Action:** modify
- **File:** `src/pages/admin/login.astro`
- **Pattern:** the current page; `src/layouts/DoorLayout.astro` (Task 5)
- **Details:** compute `door = isDoorHost(Astro.url.hostname)`. On the door host: an authed visitor goes to `/admin/checkin`; `next` defaults to `/admin/checkin`; the page renders in `DoorLayout` (dark, no public header/footer) with the same form ids and script, styled with the door palette (cream text on #161616, square red "Ingresar" button, Outfit). On the main host nothing changes.
- **Gotcha:** keep one form and one script for both looks (ids `loginForm`, `user`, `password`, `loginError`, `loginBtn`); the script listens to `astro:page-load`, so check it still fires in `DoorLayout` (no `ClientRouter` there) — if not, run it on `DOMContentLoaded` too. Julio types the credentials; never fill them.
- **Validate:** `http://checkin.localhost:4321/admin/login` shows the dark form; `http://localhost:4321/admin/login` unchanged.

### Phase B — Door screen

### Task 4: Move the result mapping into a pure module
- **Action:** create
- **File:** `src/lib/doorVerdict.ts`
- **Pattern:** `src/lib/doorDay.ts`; logic from `verdictCard`, `formatTime`, `formatDay` in `CheckinScanner.tsx`
- **Details:** export the `Verdict` type (as in the scanner) and `doorVerdict(v): { tone: "ok" | "warn" | "bad"; title: string; detail?: string }` with the Domain Assumptions' wording: `ok` → title attendee, detail `Válida · día X de N` or event name; `already` → `Ya entró hoy` / `Ya usada`, detail `attendee · hh:mm` (keep "a las" only where it reads today); `out_of_range` → `Fuera de fechas`, detail `attendee · 15 ene a 17 ene`; `not_paid` → `Pago no confirmado`; `not_found` → `No encontrada`; `error` → `Error de red`, detail `Reintenta`. Move `formatTime` / `formatDay` here unchanged.
- **Gotcha:** no repeated info (title and detail never say the same thing). Pure: no React, no `@/` imports.
- **Validate:** `node --experimental-strip-types --test tests/door-verdict.test.ts`

### Task 5: Door layout (full screen, fonts, PWA tags)
- **Action:** create
- **File:** `src/layouts/DoorLayout.astro`
- **Pattern:** `src/layouts/AdminLayout.astro` head; `src/components/FestivalFont.astro`
- **Details:** `<html lang="es">`, `viewport` with `viewport-fit=cover`, `robots noindex`, `theme-color #161616`, `<link rel="manifest" href="/checkin.webmanifest">`, `apple-touch-icon` `/icons/checkin-180.png`, `apple-mobile-web-app-capable` + `mobile-web-app-capable` `yes`, `apple-mobile-web-app-status-bar-style black-translucent`, `apple-mobile-web-app-title Puerta`; Anton + Outfit from Google Fonts (one stylesheet link); imports `@/styles/global.css` for Tailwind; body `bg-[#161616] text-[#f3e9d2] h-dvh overflow-hidden` in Outfit; `astro-island { display: contents }` as in AdminLayout; inline script registering `/checkin-sw.js` with `{ scope: "/admin/checkin" }` when `serviceWorker` exists (errors ignored).
- **Gotcha:** no theme toggle (door is always dark). Safe areas: pad with `env(safe-area-inset-*)`.
- **Validate:** page source on `/admin/checkin` has the manifest link and theme-color.

### Task 6: Door page uses the new layout
- **Action:** modify
- **File:** `src/pages/admin/checkin.astro`
- **Pattern:** current file
- **Details:** use `DoorLayout`; pass `exitHref={isDoorHost(Astro.url.hostname) ? null : "/admin"}` to `<CheckinScanner client:only="react" />`. Title `Puerta | AFRO IN`.
- **Gotcha:** keep `prerender = false` (auth runs in the middleware).
- **Validate:** ✕ present on `localhost:4321/admin/checkin`, absent on `checkin.localhost:4321/admin/checkin`.

### Task 7: Redesign the scanner for phones
- **Action:** modify
- **File:** `src/components/CheckinScanner.tsx`
- **Pattern:** current file (keep `getDetector`, the tick loop, debounce, `submitCode` and the API call as they are)
- **Details:**
  - Props `{ exitHref: string | null }`.
  - Layout: full-height column; top bar (logo or "PUERTA" in Anton, valid count, mute toggle, keyboard icon for manual entry, "Salir" → `/api/admin-logout`, ✕ link when `exitHref`);
  - a 401 from the check-in API shows a red "Sesión vencida" screen with a link to `/admin/login?next=/admin/checkin` (no auto-dismiss) instead of "Error de red"; the video fills the rest (`object-cover`) with a thin cream corner-marks viewfinder (no gold boxed frame); camera off → big square cream button "Iniciar cámara" centred; camera error → message + manual entry opened.
  - Manual entry: bottom sheet with a large monospace uppercase input and a square "Validar" button; `inputMode="text"`, `autoCapitalize="characters"`, `autoComplete="off"`.
  - Result overlay: `doorVerdict()` → full-screen layer, green #1f8a4c / amber #e6b84a (dark text) / red #d0342c; big icon, title in Anton (large, wraps), detail in Outfit; auto-dismiss after 2500 ms; tap anywhere dismisses sooner; while it shows, the tick loop does not submit (reuse `busyRef` or check the verdict ref).
  - Feedback: Web Audio API oscillator beeps per tone (one `AudioContext` created/resumed inside the "Iniciar cámara" and "Validar" handlers); `navigator.vibrate?.(pattern)`; mute stored in `localStorage` key `door-muted` (try/catch).
  - Use `lucide-react` icons already in the project.
- **Gotcha:** clear the dismiss timer on unmount and when a new verdict arrives. A same-code re-scan within 3 s stays ignored (existing debounce). Square buttons (`rounded-none`). No text repeated between bar, overlay and sheet.
- **Validate:** Level 5 (local and phone).
- **Time-box:** 90 min for the layout; fall back to fewer visual details, never to dropping the auto-dismiss or the feedback.

### Phase C — PWA

### Task 8: App icons
- **Action:** create
- **File:** `public/icons/checkin-192.png`, `public/icons/checkin-512.png`, `public/icons/checkin-maskable-512.png`, `public/icons/checkin-180.png`
- **Pattern:** N/A
- **Details:** from `src/assets/img/logos/afroin.png` with `sips` (macOS, no dependency): resize the logo to ~80% of the width (any-purpose) or ~60% (maskable, inside the safe zone), then pad to a square with `--padColor F3E9D2` (cream, the red logo stays readable). Check each PNG visually.
- **Gotcha:** if the logo PNG has a white (not transparent) background, the cream padding shows a white box: then pad with `FFFFFF` instead and note it. Keep each file small (< 60 KB).
- **Validate:** `sips -g pixelWidth -g pixelHeight public/icons/*.png`; open them.
- **Time-box:** 20 min.

### Task 9: Manifest, service worker, offline page, headers
- **Action:** create / modify
- **File:** `public/checkin.webmanifest`, `public/checkin-sw.js`, `public/checkin-offline.html`, `public/_headers`
- **Pattern:** N/A (no PWA in the project yet)
- **Details:**
  - Manifest: `name "AFRO IN Puerta"`, `short_name "Puerta"`, `id "/admin/checkin"`, `start_url "/admin/checkin"`, `scope "/admin/"`, `display "standalone"`, `orientation "portrait"`, `background_color "#161616"`, `theme_color "#161616"`, `lang "es"`, icons 192/512 (`any`) and maskable 512.
  - SW (plain JS, ~40 lines): `CACHE = "door-v1"`; `install` caches `/checkin-offline.html` and the icons, `skipWaiting`; `activate` deletes other `door-*` caches, `clients.claim`; `fetch`: ignore non-GET and any `/api/` URL; navigations → network, on failure the cached offline page; `/_astro/` assets → cache first, then network and store. Never cache HTML of admin pages.
  - Offline page: static, dark, "Sin conexión — la puerta necesita internet para validar", a "Reintentar" button (`location.reload()`).
  - `_headers`: `/checkin-sw.js` → `Cache-Control: no-cache`; `/checkin.webmanifest` → `Content-Type: application/manifest+json`.
- **Gotcha:** the SW file sits at the root so it may use scope `/admin/checkin`; it controls only the door page. Do not intercept `/api/admin/checkin`: scans always hit the server (no offline validation in v1).
- **Validate:** Chrome DevTools → Application: manifest without errors, SW activated; in `astro dev`, `curl -sI http://localhost:4321/checkin.webmanifest` 200.

### Phase E — Door role

### Task 11: Additive migration for the expiry date
- **Action:** create
- **File:** `migrations/0015_add_admin_active_until.sql`
- **Pattern:** `migrations/0012_add_event_end_date.sql`
- **Details:** `ALTER TABLE admins ADD COLUMN active_until TEXT;` (Bogotá calendar date `YYYY-MM-DD`, NULL for superadmin/admin). Header comment: additive; not idempotent (never re-run); production before the code.
- **Gotcha:** apply to local D1 (`--local --env local`) and staging (`--config wrangler.preview-migrations.jsonc --remote`, orchestrator's standing approval) only; production is Julio's. **The new code reads `active_until` on every admin request: without 0015, `verifyAdminSession` fails closed and locks every admin out** — the release must wait for Julio's migration.
- **Validate:** `npx wrangler d1 execute DB --local --env local --command "SELECT name FROM pragma_table_info('admins')"` lists `active_until`.

### Task 12: Role rules as a pure module
- **Action:** create
- **File:** `src/lib/adminRoles.ts`
- **Pattern:** `src/lib/doorDay.ts`
- **Details:** `type AdminRole = "superadmin" | "admin" | "door"`; `parseRole(raw): AdminRole` (`superadmin`/`door` exact, anything else `admin`); `isDoorPath(pathname)` — the allow list from Task 1 (`/admin/checkin`, `/admin/login`, `/api/admin-login`, `/api/admin-logout`, `/api/admin/checkin`, trailing slash allowed); make `doorHostRoute` (Task 1) use it so both lists are one; `accountActive({ role, active_until }, now)` — non-door: true; door: `active_until` is a valid `YYYY-MM-DD` and `doorDay(now) <= active_until`; `validActiveUntil(raw, now)` for the API (format + not before today's door day).
- **Gotcha:** import `doorDay` relatively. `npm test` loads `.ts` files directly; check how `tsconfig.json` treats a `./doorDay.ts` specifier (`allowImportingTsExtensions`) before choosing `./doorDay` vs `./doorDay.ts`, and keep both `npm test` and `npm run check` green. Default for an unknown role stays `admin` (current behavior), never `superadmin`.
- **Validate:** `node --experimental-strip-types --test tests/admin-roles.test.ts`

### Task 13: Sessions and the API guard know the role
- **Action:** modify
- **File:** `src/lib/adminAuth.ts`
- **Pattern:** current `verifyAdminSession` / `requireAdmin`
- **Details:** `AdminUser.role: AdminRole`, plus `active_until: string | null`. D1 branch selects `active_until`, maps the role with `parseRole`, and returns null when `!accountActive(row, Date.now())`. `requireAdmin(ctx, opts?: { allowDoor?: boolean })` returns null for a `door` user unless `allowDoor` — **deny by default**, so the 16 other API files refuse door users without being edited.
- **Gotcha:** the env account stays `superadmin`. Do not change the token format (existing sessions stay valid).
- **Validate:** `npx tsc --noEmit`; Level 4 door-session curls.

### Task 14: Check-in API admits door users
- **Action:** modify
- **File:** `src/pages/api/admin/checkin.ts`
- **Pattern:** current file
- **Details:** `requireAdmin(ctx, { allowDoor: true })`. Nothing else changes (response has no contact data).
- **Gotcha:** this must stay the only `allowDoor` in the repo (a test enforces it).
- **Validate:** `tests/door-access.test.ts`.
- **Validation:** unchanged (`code` required, ≤ 40 chars). **Error UX:** unchanged (401 → "Error de red" screen; Task 7 shows "Sesión vencida" with a login link on 401 instead).

### Task 15: Middleware refuses door users outside the door
- **Action:** modify
- **File:** `src/middleware.ts`
- **Pattern:** step (0)
- **Details:** use `verifyAdminSession` instead of `isValidAdminSession`; store the user in `context.locals.admin`; if `role === "door"` and `!isDoorPath(pathname)` → 302 `/admin/checkin`. API files are guarded by Task 13 (the middleware only covers `/admin` pages).
- **Gotcha:** one D1 read per admin page as today (no extra query). Add `admin?: AdminUser` to `App.Locals` in `src/env.d.ts`.
- **Validate:** Level 4 door-session curls.

### Task 16: Login refuses expired door users; door lands on the door
- **Action:** modify
- **File:** `src/pages/api/admin-login.ts`, `src/pages/admin/login.astro`, `src/pages/admin/checkin.astro`
- **Pattern:** current files
- **Details:** login: select `active_until`; an expired door account gets the same 401 `invalid` as a wrong password (same PBKDF2 cost, no timing hint). `login.astro`: an authed door user goes to `/admin/checkin`. `checkin.astro`: `exitHref` is null on the door host **or** when `Astro.locals.admin?.role === "door"`.
- **Gotcha:** keep the timing-equalizing path intact.
- **Validate:** Level 4.

### Task 17: Admins API accepts the door role
- **Action:** modify
- **File:** `src/pages/api/admin/admins/index.ts`, `src/pages/api/admin/admins/[id].ts`
- **Pattern:** current role validation
- **Details:** accept `role: "door"`; for `door`, `active_until` is required and must pass `validActiveUntil` (400 "Fecha 'Activo hasta' inválida"); for other roles store NULL. GET adds `active_until`. PUT: only superadmins change role/`active_until` (existing rule); switching a door user to admin clears `active_until`.
- **Gotcha:** door users never reach these handlers (Task 13), so the self-edit path never applies to them.
- **Validation:** `active_until` `^\d{4}-\d{2}-\d{2}$`, a real date, not before today's door day. **Error UX:** the dashboard shows the API's `error` as it does today.
- **Validate:** Level 4 curl with a superadmin session (Julio's login in the browser).

### Task 18: Administradores UI for door users
- **Action:** modify
- **File:** `src/components/admin/AdminsDashboard.tsx`
- **Pattern:** current role select and badge
- **Details:** role option "Puerta (solo check-in)"; when selected, a required date input "Activo hasta"; badge "Puerta" (neutral colour) with the date, "Vencido" once past (`accountActive`); `AdminRecord.role` gains `"door"`, plus `active_until`.
- **Gotcha:** import from `@/lib/adminRoles` only browser-safe code (it is pure). Keep the "Rol" column width readable.
- **Validate:** Level 5 (Julio creates a door user).

### Phase D — Docs

### Task 10: Record the door host
- **Action:** modify
- **File:** `.agents/orchestrator.md`, `.agents/plans/2026-10-27-work-list.md`
- **Pattern:** existing entries
- **Details:** work list: D26 entry (in the plan commit) and, at the end, Julio's production steps as an O item. Orchestrator: one line under deploys — `checkin.afroin.org` is a production custom domain (door only); never name a Preview `checkin`.
- **Gotcha:** N/A
- **Validate:** read the diff.

## Test Tasks
- `tests/door-host.test.ts` (Phase A commit): `isDoorHost` positives/negatives listed in Task 1; `doorHostRoute` for every allowed path (with and without trailing slash), `/api/admin/orders` → `not_found`, `/admin/pedidos`, `/`, `/tienda` → `door`.
- `tests/door-verdict.test.ts` (Phase B commit): each result → tone and title; multi-day `ok` detail "Válida · día 2 de 3"; one-day `ok` detail = event name; `already` with `today` → "Ya entró hoy"; `out_of_range` detail contains both dates; title never equals detail.
- `tests/admin-roles.test.ts` (Phase E): `parseRole` (`door`, `superadmin`, `admin`, unknown → `admin`); `accountActive`: admin/superadmin always true; door with NULL/garbage date false; door at 23:00 and at 05:59 the day after `active_until` true; at 06:00 false; `validActiveUntil` rejects past days, bad formats, `2027-02-30`.
- `tests/door-access.test.ts` (Phase E) — proves the refusal for every route, including future ones:
  - walks `src/pages/admin/**` and `src/pages/api/admin/**` with `node:fs`, turns each file into its route (`[id]` → `1`, `[type]` → `x`, `index` → parent), and asserts `isDoorPath(route)` is true **only** for `/admin/checkin`, `/admin/login` and `/api/admin/checkin`; the expected counts are 15 pages and 17 APIs (a new file changes the count and forces a look);
  - reads every API file and asserts each calls `requireAdmin(` and that `allowDoor` appears only in `src/pages/api/admin/checkin.ts`.
- Regression (manual, Level 5): the main admin still works (sidebar, mobile menu "Puerta" link, logout), and login on `afroin.org/admin/login` still lands on `/admin/donadores`.

## Validation Checklist
- [ ] **Level 1 — Lint & Format:** no lint script in the repo (N/A).
- [ ] **Level 2 — Type Check:** `npx tsc --noEmit`, then `npm run check` (astro build + tsc + wrangler dry-run).
- [ ] **Level 2.5 — Code Review:** `code-review` skill on the changed files; review saved to `.agents/code-reviews/d26-door-mobile.md`.
- [ ] **Level 3 — Unit Tests:** `npm test`.
- [ ] **Level 4 — Integration:** `astro dev` (worktree, `--env-file` = main checkout `.env`, local D1). curl matrix, no cookie: `checkin.localhost:4321/admin/pedidos` → 302 `/admin/checkin`; `/admin/checkin` → 302 `/admin/login?next=…`; `/api/admin/orders` → 404; `/api/admin/checkin` POST → 401; `localhost:4321/admin/pedidos` → 302 login (unchanged); `/checkin.webmanifest` and `/checkin-sw.js` → 200. Door session: a local-only test door user (row inserted in local D1 with a generated test password, recorded in the scratchpad, never committed) logs in through `/api/admin-login`; with its cookie, GET each of the 14 non-door admin pages → 302 `/admin/checkin`, call each of the 16 non-check-in API files (one method each) → 401, POST `/api/admin/checkin` → 200; set its `active_until` to yesterday → the same cookie gets 302 login / 401, and login → 401.
- [ ] **Level 5 — Human (Julio, before merge):**
  1. Local, Julio's browser: `http://checkin.localhost:4321` → login (dark) → door; scan/enter a valid code, the same code again, a wrong code: green/amber/red full screen, sound, back to camera in ~2.5 s, tap closes sooner; `http://localhost:4321/admin/checkin` shows the ✕ to the admin.
  2. Phone (the LAN is blocked by the https redirect): push the branch, deploy a Preview named `checkin-d26` (`npm run build && npx wrangler preview --name checkin-d26 --env-file=<main checkout>/.env`) → `https://checkin-d26.afroin.org` acts as the door host on staging data. Julio logs in with a staging admin, scans `DEV0000001` (green, then amber), a wrong code (red), checks vibration (Android) and sound, and installs it ("Añadir a pantalla de inicio") to see the icon and the standalone screen. First `curl -sI` the URL: a 302 to `cloudflareaccess.com` means Access covers it.
  3. Local, as superadmin: in Administradores create a "Puerta" user with "Activo hasta" = today, log in with it in a private window: only the door, no ✕, "Salir" works; typing `/admin/pedidos` lands on the door.
  If skipped: the phone look, sound/vibration and install ship unobserved.

## Production steps for Julio
**Before the release** (the code locks every admin out without it):
0. Apply `migrations/0015_add_admin_active_until.sql` to production D1, then verify `SELECT name FROM pragma_table_info('admins')` lists `active_until`. Record it in the work list's *Applied in production*. Never re-run it.

**After the release reaches `main`:**
1. Cloudflare → Workers & Pages → `afro-in` → **Domains** → **+ Add Domain** → `checkin.afroin.org`, **Enable for: Production** → Add domain.
2. Cloudflare → `afroin.org` zone → **Rules → Redirect Rules → Create rule** "Door root": *When* `Hostname equals checkin.afroin.org` **and** `URI Path equals /` → *Then* Static, URL `https://checkin.afroin.org/admin/checkin`, status **302**, preserve query string off → Deploy.
3. Verify (the orchestrator can run these): `curl -sI https://checkin.afroin.org/` → 302 to `/admin/checkin`; `curl -sI https://checkin.afroin.org/admin/pedidos` → 302 `/admin/checkin`; `curl -s https://checkin.afroin.org/api/contador` → 404 (door host); `curl -s https://checkin.afroin.org/admin/login | grep -o '/_astro/[^"]*' | sort -u` equals the same for `https://afroin.org/admin/login` (same production build; a 404/522 or other asset names means the Preview wildcard won: stop and tell the orchestrator). Execution note: the first draft compared `/api/contador`, which the door host answers with 404.
4. Never create a Preview named `checkin`.

## Acceptance Criteria
- [ ] On a phone, the door fills the screen; results are full-screen green/amber/red with D25's wording, sound and vibration (where supported), and return to the camera in ~2.5 s or on tap.
- [ ] Manual code entry works and shows the same result screen.
- [ ] On the door host, only the door and its login are reachable among SSR pages and APIs; other admin pages redirect to the door, other APIs 404; auth unchanged (host-only cookie, its own login).
- [ ] On afroin.org the door has a ✕ back to `/admin`; the rest of the admin is unchanged.
- [ ] The app installs (manifest valid, icon, standalone); scans always reach the server.
- [ ] A door user reaches only the door screen and the check-in API; every other admin page redirects to the door and every other admin API answers 401, proven by `tests/door-access.test.ts` and the Level 4 curls.
- [ ] A door user stops working after its "Activo hasta" door day, in an open session too.
- [ ] Superadmins create, edit, disable and delete door users in Administradores; other admins cannot.
- [ ] `npm run check` and `npm test` pass.

## Confidence Score: 7/10
- **Strengths:** host-only cookies already give a separate, equally strong session on the subdomain; the door role is deny-by-default in the one API guard and in the one page guard; the scanner's camera and detection code stays; the role needs no schema change, only the expiry column.
- **Uncertainties:** whether a production custom domain beats the `*.afroin.org` Preview wildcard; iOS standalone camera/sound quirks; icon look; release order (0015 before code) on a same-day release.
- **Mitigations:** Julio's step 3 checks the domain against production data; the phone test runs on an https Preview before merge; the route-walking test catches any admin route the plan missed; the migration step is first in Julio's list and in the PR body.

## Phase Boundaries
19 tasks (above the 12 guideline): kept in one plan and one PR because the door host and the door role share the same guards (`doorHost.ts` / `adminRoles.ts`, middleware, `requireAdmin`); each phase is its own commit.
1. Plan commit: this plan + D26 in the work list.
2. Phase A (Tasks 1–3, plus Task 5 which Task 3 needs) + `tests/door-host.test.ts`.
3. Phase B (Tasks 4, 6, 7) + `tests/door-verdict.test.ts`.
4. Phase C (Tasks 8–9).
5. Phase E (Tasks 11–18) + `tests/admin-roles.test.ts` + `tests/door-access.test.ts` (Task 12 moves the allow list out of `doorHost.ts`; `tests/door-host.test.ts` stays green).
6. Phase D (Task 10, plus the 0015 step and the door role in the work list), code review file, then push and PR.

## Notes for Executing Agent
- Talk to Julio in Spanish; code, comments, commits in English (Conventional Commits).
- Never read or print `.env` / `.dev.vars`; Julio types admin credentials.
- Do not touch Cloudflare dashboard settings; the steps above are Julio's.
- The release order does not matter for the code: without the custom domain nothing serves the door host in production.

> **UI Styling Note:** colours, sizes and labels are `[provisional]` — expect changes after Julio sees it.
>
> **Expected UX iterations: 3**
