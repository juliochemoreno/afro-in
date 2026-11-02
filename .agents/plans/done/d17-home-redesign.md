# Plan: D17 — Home redesign: today's sections in the 2027 language

> Archived 2026-11-02. Done: commit 25a0bce, merged into `dev` as ef0263e. Report: `.agents/execution-reports/d17-home-redesign.md`. Not in production yet.

## Overview
Redesign each section of today's home without moving away from it (Julio, 2026-11-02): same 10 sections, same order, same container, all on a dark background, with the 2027 visual language (Anton titles, red kicker, square corners, red square buttons, faded photos instead of rounded frames, dark header/footer). The donation is called **Afro Acción**. Approved look: the throwaway preview `src/pages/d17-preview.astro` (theme "Todo oscuro"), not committed.

## Requirements Summary
Decisions by Julio (2026-11-02):
- Structure: today's sections and order — Hero · ¿Qué es AFRO IN? · Documental · Galería · Tienda · AFRO IN 2027 · Únete (form) · Aliados · Comunidad · Contacto. Redesign each one, do not invent new sections.
- Backgrounds: **all dark** (Julio, after comparing both themes in the preview): sections alternate #161616 and #1b1b1b so they still read as separate blocks; white text, gold numbers/dates, red buttons. Cards and tiles #222 with a #2e2e2e border. Light mode stays for D22.
- Container: all content inside the site container (`fz-wrap`); only section backgrounds are full width. Hero photo on phones is the only edge-to-edge element.
- Hero: dark, the `/programacion` headliner composition (like Robe L Ninho's block, Julio): children photo LEFT, tall, bleeding to the left screen edge and fading on its inner side and top/bottom (`.fz-headliner` markup + styles from `festival.css`), text right, vertically centred; kicker "Cultura afro independiente", title "1 Millón de Corazones", line "Tu acción cambia el mundo. No importa tu edad, tu género ni tu creencia: lo que importa es tu corazón.", a single goal (Julio picked option A): live number from `/api/contador` in gold Anton + "de 1.000.000 corazones" + a thin gold progress bar (track rgba white .18, fill gold, min 6px so it never looks empty), then red button "Adquiere tu Afro Acción" (→ `#unirse`) + text link "Conoce más" (→ `#sobre`). No milestones.
- Afro Acción = a donation of free amount (no change to the payment flow). Suggested amount shown: **$20.000 COP** (replaces $15.000). The 5 benefits stay. The form stays on the home.
- AFRO IN 2027: keeps the two stop cards (photo, badge, dates, place, highlights) with a visible "Ver programación" button each, square and dark.
- Allies: all allies with the improved logos already used by `/aliados` (`src/lib/allies.ts`: `clean/` on light, `ondark/` on dark), square tiles + one button "Ver todos los aliados" → `/aliados` (no long CTA text repeated from that page).
- Header and Footer: `variant="festival"` (unified menu from D21). No header CTA (flags stay false), no WhatsApp float.
- Mobile checked at 375 px for every section.

Workflow classification: `sequential user-driven` (donation and contact forms; logic unchanged).

## Out of Scope
- Payment flow, `/api/*`, DB, Bold/PayPal, `/gracias`, admin — untouched.
- Light/dark switch (D22). New donation features. Amount minimum in the form ("$5 USD" stays).
- Expected UX iterations: 3 (spacing, photo crops and copy will be tuned after Julio sees it locally; v1 = all 10 sections restyled, readable at 375 px).

## Likely Follow-ups
- `/gracias` and the thank-you wording in the Afro Acción voice; a thank-you email.
- Choosing better gallery/community photos (some are low resolution: `gente-afroin-h-*` are 960 px).
- D22 theme switch.

## Git Strategy
- **Base branch:** `dev`
- **Feature branch:** this worktree's branch `claude/d17-home-redesign-661a3c` → one PR to `dev`.

## Context References
- `src/pages/d17-preview.astro` — approved mock-up (theme "dark", `#dark`): markup and CSS to port into the real components; excluded from git via `.git/info/exclude`; delete at the end.
- `src/templates/HomeTemplate.astro` — section list; add `FestivalFont`, `festival.css`, `Header/Footer variant="festival"`, `<main class="fz">`.
- `src/styles/festival.css` — `.fz`, `.fz-wrap` (container: `--fz-content-max: 1136px`, `--fz-gutter` 32px / 16px on phones), `.fz-display`, `.fz-button`, `a.fz-button-solid`; the `.fz` scope sets white text and the dark background the whole home now uses.
- Components to restyle in place (each has its own scoped `<style>` on old tokens `--color-cream`, `section-badge`, `btn`, rounded radii):
  - `src/components/Hero.astro` (487 lines; also used by `UnirseTemplate.astro`) — remove float cards, scroll indicator and the old counter card; keep the counter `<script>` (fetch `/api/contador`) for the new goal bar.
  - `src/components/About.astro` (462; also `UnirseTemplate`) — keep features, impact list, stats; stats numbers today 10+/8/100+/5000 in code vs 9+/7/91+/5K+ shown: keep the component's own animated values.
  - `src/components/Documentary.astro`, `Gallery.astro` (keep filter + lightbox script), `Store.astro` + `FeaturedProducts.astro`/`ProductCard.astro` (server island reading D1; restyle cards only), `Events.astro` (2027 cards), `Registration.astro` (1377; keep `<script>` and ids), `Allies.astro`, `Community.astro`, `Contact.astro` (keep WhatsApp-template script).
- Only `HomeTemplate` uses Documentary/Gallery/Store/Events/Allies/Community/Contact; Hero/About/Registration are also used by `UnirseTemplate.astro` (`/unirse`, `/en/join`, `/fr/rejoindre`). Verified: `grep -rlE "components/(Hero|About|Documentary|Gallery|Store|Events|Registration|Allies|Community|Contact)\.astro" src` → HomeTemplate, UnirseTemplate, EditionPartners (comment only).
- `src/i18n/locales/{es,en,fr}.json` — hero.*, about.community.desc.part2 ("$15.000 COP"), join.* (form title/next button), allies.*, events.*.
- Local dev: the home shows a D1 error overlay locally (`no such table: products`, from the store server island) unless local D1 migrations are applied; not caused by this work.

## Domain Assumptions
- Afro Acción is a donation; "Adquiere tu Afro Acción" is the button wording only — confirmed by Julio.
- The "ya se han unido" counter in the form section goes away: the hero already shows the number (no repeated info) — confirm.
- en/fr keep "Afro Acción" as a brand term ("Your Afro Acción" / "Votre Afro Acción") — confirm.
- en/fr menu nit: dropdown child stops repeating the parent ("About › Our story", "À propos › Notre histoire") — confirm.
- "Quiero ser parte" stays as the About button (it is today's copy); the brief reserves it for tour pages — confirm or change to "Adquiere tu Afro Acción".

## Implementation Tasks

### Task 1: Home shell
- **Action:** modify
- **File:** `src/templates/HomeTemplate.astro`
- **Pattern:** `src/templates/AlliesTemplate.astro` (FestivalFont, festival.css, Header/Footer festival, `<main class="fz">`)
- **Details:** same section order as today; add the festival shell; no new sections.
- **Gotcha:** keep anchors used by the menu: `#inicio`, `#sobre`, `#galeria`, `#tienda`, `#afrotour`, `#unirse`, `#aliados`, `#comunidad`, `#contacto`.
- **Validate:** `npx tsc --noEmit`; `/`, `/en`, `/fr` render.

### Task 2: Hero
- **Action:** modify
- **File:** `src/components/Hero.astro`
- **Pattern:** `src/components/EditionHeadliner.astro` markup / `.fz-headliner-*` in `festival.css` (as in the preview's `#inicio`)
- **Details:** dark section using `.fz-headliner fz-headliner--center` (photo left bleeding to the screen edge, text right), kicker, Anton title, line, goal (number + "de 1.000.000 corazones" + thin gold bar, as preview `.pv-goal`), red button + text link; phones: photo band on top, edge to edge, text below. Keep the counter script (fetch `/api/contador`, animate the number, set bar width = total/1,000,000 with a 6px minimum); remove float cards, scroll indicator and the old counter card.
- **Gotcha:** `UnirseTemplate` also renders Hero (Task 8).
- **Validate:** screenshot 1280 and 375 px; no horizontal scroll.

### Task 3: Copy (es/en/fr)
- **Action:** modify
- **File:** `src/i18n/locales/es.json`, `en.json`, `fr.json`
- **Pattern:** existing key groups
- **Details:** hero kicker/line/button/link; `about.community.desc.part2` → "$20.000 COP"; form title "Tu Afro Acción", next button "Continuar con mi Afro Acción"; allies button; en/fr equivalents; menu nit if confirmed. Remove keys only if no longer used anywhere.
- **Gotcha:** identical key sets in the three files; `join.description` is HTML.
- **Validate:** `npx tsc --noEmit`; grep new keys in all three files.

### Task 4: About, Documentary, Gallery
- **Action:** modify
- **File:** `src/components/About.astro`, `src/components/Documentary.astro`, `src/components/Gallery.astro`
- **Pattern:** preview `#sobre`, `#documental`, `#galeria`
- **Details:** About: centred head (red kicker, Anton title, subtitle), left text + red-square list + button, right 2×2 square feature cards (red icon), dark stats bar with gold numbers. Documentary dark: centred head, square 16:9 video with red play button and label, quote. Gallery: centred head, square grid with one large photo; keep filters/lightbox, restyle chips as square.
- **Gotcha:** keep About's counter animation script if it drives the stats.
- **Validate:** each at 375 px; filters and lightbox still work.

### Task 5: Store and 2027 cards
- **Action:** modify
- **File:** `src/components/Store.astro`, `src/components/ProductCard.astro` (home variant only if shared), `src/components/Events.astro`
- **Pattern:** preview `#tienda`, `#afrotour`
- **Details:** Store: centred head; product cards like the `/programacion` artist cards (`.edition-artist` in `Edition2027IndexTemplate.astro`, Julio): 4:5 photo filling the card, dark scrims top and bottom, category left and gold price right on top, Anton name + visible "Ver producto" at the bottom; 4 columns (2 on phones); red button "Ir a la tienda". Price, name and category come from D1 (`FeaturedProducts`). 2027 dark: two square cards (photo fading at the bottom, red badge, gold date and place, highlights, red "Ver programación").
- **Gotcha:** `ProductCard` is also used on `/tienda`; scope new styles to the home or confirm the store page still looks right. Dates and links come from `tour2027` content (no hardcoding).
- **Validate:** home + `/tienda` at 1280 and 375 px.

### Task 6: Registration (form)
- **Action:** modify
- **File:** `src/components/Registration.astro` (styles + header/benefits markup only)
- **Pattern:** preview `#unirse`
- **Details:** two halves in two dark tones (#161616 / #1f1f1f) as today's split; "Únete al movimiento" kicker, "Tu Afro Acción" title, $20.000 COP text, benefits as red-square list, dark square form card with icon inputs and red button. Remove the "ya se han unido" counter if confirmed.
- **Gotcha:** do not change `<script>`, ids, `data-t-*`, endpoints; check validation errors and the PayPal/Bold step on dark.
- **Validate:** step 1 → step 2 locally; `git diff` shows no script changes.

### Task 7: Allies, Community, Contact
- **Action:** modify
- **File:** `src/components/Allies.astro`, `src/components/Community.astro`, `src/components/Contact.astro`
- **Pattern:** preview `#aliados`, `#comunidad`, `#contacto`
- **Details:** Allies: centred head, every ally from `src/lib/allies.ts` using the improved logos (`imageOnDark` = `aliados/ondark/*-contorno.png`, used here since the section is dark; fall back to `image` when an ally has none), order: this edition's allies FIRST (the ones `AlliesTemplate.astro` shows under this edition: La Puerta, Co·KoA, Masaya, then Caribeam Team, Kombilesa Mi, Tayrosoft — reuse its lists/logos), then every other ally from `src/lib/allies.ts` without repeating any (Julio, 2026-11-02); square dark tiles in a 6-column grid (3 on phones), one red button → `/aliados` (via `getTranslatedPath`), drop the long CTA block. Community dark: head, photo grid, outline button. Contact: text + square dark form card, red button.
- **Gotcha:** Contact WhatsApp script untouched; floating WhatsApp stays off.
- **Validate:** links resolve in es/en/fr; 375 px.

### Task 8: `/unirse` keeps working
- **Action:** modify
- **File:** `src/templates/UnirseTemplate.astro`
- **Pattern:** HomeTemplate after Task 1
- **Details:** add `FestivalFont`/`festival.css`/`fz` so Hero, About and Registration render correctly there; keep `Header variant="minimal"`.
- **Gotcha:** `/en/join`, `/fr/rejoindre` share it.
- **Validate:** the three join URLs at 1280 and 375 px.

### Task 9: Cleanup
- **Action:** delete / modify
- **File:** `src/pages/d17-preview.astro` (untracked), `.git/info/exclude` line
- **Details:** delete the preview and its exclude line; remove CSS/keys left unused by the restyle (grep first).
- **Gotcha:** `events.*` keys may be used by 2027 templates.
- **Validate:** `npm run check`.

## Test Tasks
Visual/copy work, no new logic: run `npm test` to prove nothing else moved. Manual regression: donation form both steps, contact form, gallery filters + lightbox, store cards on home and `/tienda`, `/unirse` in 3 languages, menu on `/` vs `/programacion`.

## Validation Checklist
- [x] **Level 1 — Lint & Format:** WAIVED: the repo has no lint script; the build in `npm run check` covers syntax.
- [x] **Level 2 — Type Check:** ✓ `npx tsc --noEmit` clean before the commit (and again on dev's tip by the orchestrator).
- [x] **Level 2.5 — Code Review:** ✓ `.agents/code-reviews/d17-home-redesign.md` (1 high, 2 medium, 1 low kept; 3 fixed, 1 pre-existing skipped; second pass with no new findings).
- [x] **Level 3 — Unit Tests:** ✓ `npm test` 120/120.
- [x] **Level 4 — Integration:** ✓ `npm run check` passed; local dev on port 4391: all listed routes return 200 (`/tienda` after giving the worktree a copy of the main checkout's local D1).
- [x] **Level 5 — Human Review:** ✓ Julio reviewed the home locally in his browser over several rounds (desktop, the donation form fields and dropdowns) and approved the merge ("commit, merge directo"). WAIVED for the parts he did not report on: en/fr pages and the donation form up to the payment screen were checked by the agent only (routes 200, step 2 rendered), not by Julio.

## Acceptance Criteria
- [x] Same 10 sections, content inside the container, all dark (alternating #161616 / #1b1b1b) ✓ — order changed on Julio's request: the store now comes after AFRO IN 2027 (see the execution report).
- [x] 2027 language everywhere ✓ (checked section by section in the browser at 1024 px and 375 px).
- [x] Hero live count with the gold bar ✓ (`/api/contador`, 7 on the local D1); "Adquiere tu Afro Acción" and "Tu Afro Acción" ✓; `grep -rn '15.000' src/i18n` returns nothing ✓.
- [x] Payment/API code unchanged ✓ (no file under `src/pages/api` or `src/lib` in the diff); the donation `<script>` unchanged ✓; the contact script changed only its two field ids (review fix); `/unirse` and `/tienda` return 200 ✓.
- [x] No horizontal scroll at 375 px ✓ (`scrollWidth` 375 on `/` and `/unirse`); `npx tsc --noEmit`, `npm test`, `npm run check` pass ✓.

## Confidence Score: 8/10
- **Strengths:** direction approved on a full-page mock-up; content and order unchanged; no backend work.
- **Uncertainties:** ~4,000 lines of old scoped CSS; shared components (`ProductCard`, Hero/About/Registration on `/unirse`); local D1 overlay hides the store island in dev.
- **Mitigations:** restyle section by section with screenshots; scope shared styles; apply local D1 migrations or check the store section on the dev Preview.

## Notes for Executing Agent
- UI specs are `[provisional]`. **Expected UX iterations: 3**.
- Never read `.env`/`.dev.vars`; run dev with `--env-file=/Users/juliochemoreno/Projects/personal/afroin-web/afro-in/.env`.
- Julio does not want commit suggestions while iterating locally; standing approvals apply once he has seen it and validation passes.
