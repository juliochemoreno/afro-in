# Plan: D21 — Lighter main menu

## Overview
Replace the heavy, inconsistent header (7 items + dropdown on the home, and a different hand-made menu in each of ~15 templates) with one short menu used on the whole site, a matching footer, a cart that only shows when it has items, and a CTA that is "Comprar pase" during the 2027 festival season. All product decisions below were taken by Julio on 2026-11-01.

## Requirements Summary (decisions by Julio)
- **Menu (desktop and mobile, es/en/fr):** `Festival 2027` (direct link to `/programacion`, no submenu) · `Eventos` · `Tienda` · `Nosotros ▾` (children: Sobre nosotros `/#sobre` · Galería `/#galeria` · Aliados `/#aliados`). Plus language picker, cart, CTA.
- **Texts:** ES Festival 2027 · Eventos · Tienda · Nosotros · Comprar pase. EN Festival 2027 · Events · Store · About · Get your pass. FR Festival 2027 · Événements · Boutique · À propos · Prendre mon pass. Out of season the CTA is the current "Únete / Join us / Rejoins-nous" → `/#unirse`.
- **One menu on the whole site.** Pages stop defining their own `navLinks`; only the dark `festival` style differs (already exists). Exception: checkout, order, thank-you and join pages get a minimal header (logo + language only, no menu/CTA/cart button) so nothing distracts from payment.
- **Cart:** the cart icon is visible only when the cart has items; appears when something is added.
- **CTA season:** by fixed date, no D1: from 2026-11-01 to 2027-01-15 (inclusive, Colombia) the CTA is "Comprar pase" → `/eventos/pase-afroin-2027-santa-marta` (translated path), except on Palenque pages (`/programacion/2027/palenque*` and en/fr paths), which have no pass and show "Únete"; outside the window, "Únete". Window ends 2027-01-15 because the pass event is dated 2027-01-15T21:00 and the site hides past events (pass page redirects from 16 Jan). Home stays static, so the switch is a client-side date check; default markup is the in-season one.
- **Footer:** Festival 2027 · Eventos · Tienda · Sobre nosotros · Galería · Aliados · Contacto (Contacto `/#contacto`).
- Menu does not change by home vs festival pages or desktop vs mobile beyond style/hamburger.
- Workflow classification: `sequential user-driven` for the menu; the cart toggle is `async data-arrival` (cart-change event).

## Out of Scope
- Home redesign (D17), `src/styles/festival.css`, event/programación templates, price libs (D20 owns them; all style needed lives in `Header.astro`).
- Removing the now-ignored `navLinks`/`ctaLink` props from event/programación/artistas/tienda/comunidad/entradas templates: follow-up after D20 merges.
- Real-time pass status (sold out) in the CTA, e.g. via D20's `/api/tickets/stages` (optional; only if Julio decides to); Cloudflare Web Analytics per page: no beacon in code and the account is not reachable by the HOPLA tools, so the choice was made by purpose, not traffic.
- Comunidad and Blog stay out of menu and footer (no decision to add them).
- **Expected UX iterations: 3** (spacing of the lighter bar, dropdown on mobile, hidden-cart layout shift). "Good enough for v1": same visual language as today, fewer items.

## Likely Follow-ups
- Clean `navLinks`/`ctaLink` props and per-template menus once D20 lands.
- Link Comunidad/Blog somewhere; per-page analytics when Julio shares numbers.
- CTA reflecting sold-out via a server island.

## Git Strategy
- **Base branch:** `dev` (merge `origin/dev`, never rebase, before the PR). Worktree branch `claude/d21-lighter-menu-c0b95c`; one PR to `dev`.

## Context References
- `src/components/Header.astro` — whole file: `defaultNavLinks` (l.30-56), CTA (58-61), props (21-27), `isActive` (74-88), festival styles (224-259), mobile dropdown/toggle script (560-610, already in `astro:page-load`).
- `src/components/Footer.astro:23-30` — `quickLinks`.
- `src/components/CartWidget.astro:28-45,153-200` — `#cart-toggle.cart-icon-button`, badge; drawer is inside `.cart-widget`, so hide only the button, never the wrapper.
- `src/lib/cart.ts:27,143` — `getCart()`, `onCartChange(cb)` (window `CART_EVENT`, l.57), `openCart`/`onCartOpen` (155-161).
- `src/i18n/locales/{es,en,fr}.json` lines 2-14 (`nav.*`), `footer.*`; `src/i18n/utils.ts` `getTranslatedPath`; `src/i18n/routes.ts`.
- `src/lib/programacion.ts:120` — pass URL `/eventos/pase-afroin-2027-santa-marta`.
- Custom menus today (`grep -rn "<Header " src` → 15 templates pass `navLinks`): Checkout, Entradas, Pedido, Gracias, Artistas, Unirse, Comunidad, TiendaIndex, TiendaSlug, ProgramacionIndex/Slug, EventosIndex, EventoSlug, Edition2027Index/Stop (via `src/lib/editionNav.ts`). Layout/BlogPost/BlogIndex/BlogSlug/Home use the default.
- Anchors exist: `#sobre` About.astro:72, `#galeria` Gallery.astro:59, `#aliados` Allies.astro:191, `#contacto` Contact.astro:14, `#unirse` Registration.astro:23.
- Tests: `npm test` = `node --test tests/**/*.test.ts` (pure TS libs, see `tests/programacion.test.ts`).
- `.agents/orchestrator.md` rules 5, 10 (page-load scripts), 11.
- Dependents: after the change, `nav.tour`, `nav.program`, `nav.artists`, `nav.about`, `nav.gallery`, `nav.allies`, `nav.contact`, `nav.join` are used by 11 files (Footer, Header, editionNav, 6 templates, locales); keep keys still referenced, delete only keys with 0 hits (check with `grep -rn "nav\.<key>" src`).

## Domain Assumptions
- "Temporada" = 2026-11-01 → 2027-01-15 inclusive, Colombia date (Julio confirmed via orchestrator: the CTA shows only where there is a pass).
- Palenque has no pass (Julio): on Palenque pages the CTA is "Únete".
- Active-state: `Festival 2027` is highlighted on `/programacion*` and `/artistas*`; `Eventos` on `/eventos*`; `Tienda` on `/tienda*`; Nosotros never (anchors).
- Checkout/pedido/gracias/unirse = minimal header (decided). `entradas` (ticket view) keeps the full menu.

## Implementation Tasks

### Task 1: Add the shared menu definition
- **Action:** create
- **File:** `src/lib/mainMenu.ts`
- **Pattern:** `src/lib/editionNav.ts`
- **Details:** export `mainMenu(lang)` returning `{ items: NavLink[], footerLinks: NavLink[], passUrl }` using `t()` and `getTranslatedPath()`; export pure `isPassSeason(now: Date)` (Colombia date, `"2026-11-01" <= date <= "2027-01-15"`) and constants `PASS_SEASON_START/END`. Items per Requirements Summary; children for Nosotros.
- **Gotcha:** keep it free of Astro imports except what `editionNav.ts` already uses so `node --test` can load it (if `@/` alias breaks `node --strip-types`, take `t` and `getPath` as parameters and test only `isPassSeason`).
- **Validate:** `npm test` (after Task 6) / `npx tsc --noEmit`.

### Task 2: Add and prune locale strings (es/en/fr)
- **Action:** modify
- **File:** `src/i18n/locales/es.json`, `en.json`, `fr.json`
- **Pattern:** existing `nav.*` keys
- **Details:** add `nav.festival` ("Festival 2027"), `nav.us` (Nosotros / About / À propos), `nav.buyPass` (Comprar pase / Get your pass / Prendre mon pass); `nav.about` stays as the child label ("Sobre nosotros" in ES — change from "Sobre Nosotros" only if Julio wants); French `nav.events` already "Événements". Remove unused keys only after grep shows 0 hits.
- **Gotcha:** all three files get the same keys (rule 5); `nav.tour`/`nav.program`/`nav.artists` may still be used by templates not touched here.
- **Validate:** `node -e` script comparing key sets of the three files; `npm run check`.

### Task 3: Rewrite Header to the single menu
- **Action:** modify
- **File:** `src/components/Header.astro`
- **Pattern:** itself (keep mobile hamburger and dropdown script as is)
- **Details:** build menu from `mainMenu(lang)`; keep accepted `navLinks`/`ctaLink` props but ignore them (comment: deprecated, removed after D20); add `variant: "minimal"` (logo + `LanguagePicker` only). CTA (Palenque pages always show "Únete"; detect by path `/programacion/2027/palenque`, en/fr equivalents via `getTranslatedPath`): render both anchors ("Comprar pase" visible by default, "Únete" with `hidden`), and in the `astro:page-load` script swap by `isPassSeason(new Date())` (inline the two dates via `define:vars` or import the lib in the script). Cart: wrap button visibility with CSS `.cart-nav-item :global(.cart-icon-button){display:none}` and class `has-items` set from `getCart()` on page-load and `onCartChange`; drawer untouched. `isActive` gets prefix matching for `/programacion`, `/artistas`, `/eventos`, `/tienda` (language-aware via `getTranslatedPath`).
- **Gotcha:** scripts must run in `astro:page-load` and clean up listeners added to `window` (ClientRouter re-runs them each navigation: use `onCartChange`'s returned unsubscribe via `astro:before-swap`); never hide `.cart-widget` wrapper (drawer lives there); `openCart()` from "add to cart" must still open the drawer even when the icon is hidden. Do not touch `festival.css`.
- **Validate:** `npx astro build` then manual: home, `/tienda`, `/eventos`, `/programacion`, es/en/fr.

### Task 4: Footer links
- **Action:** modify
- **File:** `src/components/Footer.astro`
- **Pattern:** current `quickLinks`
- **Details:** `quickLinks` ← `mainMenu(lang).footerLinks` (Festival 2027, Eventos, Tienda, Sobre nosotros, Galería, Aliados, Contacto).
- **Gotcha:** Footer used by all pages incl. festival variant; keep markup/classes.
- **Validate:** `npx astro build`; view footer in es/en/fr.

### Task 5: Minimal header on payment/join pages and drop per-page menus (non-D20 templates)
- **Action:** modify
- **File:** `src/templates/CheckoutTemplate.astro`, `PedidoTemplate.astro`, `GraciasTemplate.astro`, `UnirseTemplate.astro`
- **Pattern:** `<Header variant="festival" />` usage in `EntradasTemplate.astro`
- **Details:** replace `navLinks` constants and props with `<Header variant="minimal" />`; remove unused imports. Leave all other templates (D20-adjacent and others) untouched: Header ignores their `navLinks`.
- **Gotcha:** Confirm none of these four is touched by D20 (`git diff origin/dev...origin/<D20 branch> --stat`) before editing; if one is, skip it and note.
- **Validate:** `npx astro build`; open each page.

### Task 6: Tests
- **Action:** create
- **File:** `tests/main-menu.test.ts`
- **Pattern:** `tests/programacion.test.ts`
- **Details:** `isPassSeason`: 2026-10-31 false, 2026-11-01 true, 2027-01-15 true (23:59 Colombia), 2027-01-16 false; `mainMenu` (if loadable) has 4 items, Nosotros has 3 children, footer has 7 links, urls per lang.
- **Gotcha:** Colombia is UTC-5; compute the date with `toLocaleDateString("en-CA", {timeZone:"America/Bogota"})`.
- **Validate:** `npm test`

## Test Tasks
Task 6 covers the pure logic. Regression smoke after implementation: add to cart from `/tienda` (icon appears, drawer opens, badge counts, clear cart hides icon), language switch keeps the menu, ClientRouter navigation between home → /eventos → /tienda keeps dropdown and cart state working, mobile hamburger + Nosotros accordion.

## Validation Checklist
- [ ] **Level 1 — Lint & Format:** none configured in the project (orchestrator.md); skip.
- [ ] **Level 2 — Type Check:** `npm run check` (astro build + tsc + wrangler dry-run)
- [ ] **Level 2.5 — Code Review:** `code-review` skill on the branch diff
- [ ] **Level 3 — Unit Tests:** `npm test`
- [ ] **Level 4 — Integration:** curl the branch build via `astro dev`: `/`, `/en`, `/fr`, `/tienda`, `/eventos`, `/programacion`, `/checkout` return 200 and contain the new labels.
- [ ] **Level 5 — Human Review (Julio, on the branch Preview, desktop and mobile, before merge):** menu items/labels in es/en/fr; Nosotros dropdown; CTA text in season; cart icon hidden when empty and appearing on add; minimal header on checkout/pedido/gracias/unirse; footer links. If skipped, the lighter menu ships unseen on mobile.

## Acceptance Criteria
- [ ] Every public page shows the same 4 menu items (except minimal pages) in es/en/fr.
- [ ] Contacto and Aliados reachable from the footer; Galería/Aliados/Sobre nosotros from Nosotros.
- [ ] Cart icon hidden when empty, visible with items, drawer still opens after add.
- [ ] CTA reads "Comprar pase" and links to the festival pass between 2026-11-01 and 2027-01-15; "Únete" otherwise.
- [ ] `npm run check` and `npm test` pass; no change to `festival.css`, event/programación templates or price libs.

## Confidence Score: 8/10
- **Strengths:** all decisions taken; single component change; anchors and cart API verified.
- **Uncertainties:** `node --test` alias loading for `mainMenu.ts`; cart listener cleanup under ClientRouter; whether D20 touches the four templates in Task 5.
- **Mitigations:** parametrize `t`/path or test only `isPassSeason`; use `astro:before-swap` cleanup; check D20 diff first.

## Notes for Executing Agent
Merge `origin/dev` before the PR. UI styling is `[provisional]`; expect ~3 rounds of visual feedback from Julio. Do not commit secrets; never read `.env`.
