# Plan: Programación AFRO IN 2027 (D9, first delivery)

## Overview

Publish the AFRO IN 2027 programming (listing + one page per stop) in es/en/fr with the approved "festival zone" design, and keep the 2026 edition reachable, unchanged in look, under `/programacion/2026/…`. Design is fixed by `.agents/specs/2026-10-27-programacion-2027.md` and the approved mockup https://claude.ai/artifact/CwcZwDuAuNv8pqPsMAysZJ.

## Requirements Summary

- `/programacion` (+ `/en/program`, `/fr/programme`) shows the 2027 listing with the new design: hero "AFRO IN 2027", gold-framed block with the two stops, guest artists grid, "Edición 2026" band.
- `/programacion/2027/<slug>` (+ en/fr) shows each 2027 stop: hero with dates and day jump links, one framed card per day with its activities, "por anunciar" when a day or stop has no agenda, next-stop band, Schema.org `Event` JSON-LD.
- 2026 listing moves to `/programacion/2026`, 2026 stops to `/programacion/2026/<slug>` (+ en/fr), rendered by the existing templates with their current look.
- Old 2026 URLs redirect 301 to the `/2026/` ones; `/programacion/2027` (no slug) redirects to `/programacion`.
- Site header and footer unchanged; red `#e31c25`; Outfit body; Anton display font loaded only on the 2027 pages.
- Nav dropdown entries "Santa Marta" / "Palenque" point to the 2027 stops everywhere.
- Content from Julio's images (see spec, "Initial 2027 content"); Afro Batalla shows "Inscripciones muy pronto" (no button) until a paid registration page exists.
- Workflow classification: static content pages, no reactive state (neither async data-arrival nor user-driven flow). Only interaction: in-page anchor links.

## Out of Scope

- "Entradas" link from stops to `/eventos` (D2, Julio: later).
- Paid Afro Batalla registration page (Julio, 2026-10-28: needs its own page with a fee; money path → new work-list item for the orchestrator).
- Redesign of home, store, product, checkout, tickets (later D9 deliveries).
- Home section `src/components/Events.astro` (still describes the 2026 tour via `events.sm.*` / `events.plk.*` keys) and `/artistas` (`ArtistasTemplate.astro` reads `tour2026`): unchanged here, listed as follow-ups.
- Clean artist photos (AFRO IN sends PNGs later; this delivery uses crops from the posters).

## Likely Follow-ups

- Swap artist photos for the clean PNGs (one file per artist under `src/assets/img/2027/artistas/`).
- URGENT: ticket sales with date-based prices; the first tier (1–15 Nov 2026, $20.000, "solo con registro en afroin.org") starts on 2026-11-01. The current ticketing has one price per event; tiers were "Ticketing v2". Money path → orchestrator work item.
- Fill venues and times (Palenque, Robe L Ninho) as Julio sends them (edit `src/content/tour2027/*.md`).
- D2: "Comprar entradas" band per stop.
- Paid Afro Batalla registration (set `signupUrl` on the activity once it exists; the button already renders when the field is present).
- Home "Events" section and `/artistas` pointing to 2027.
- Rest of D9 (store, product, checkout, tickets) in the festival style or a lighter variant.

## Git Strategy

- **Base branch:** `dev` (this worktree branch was cut from `origin/dev` at `38c6c29`).
- **Feature branch:** `claude/d9-redesign-programacion-b8d8eb` (the session's worktree branch; Worker Preview at its sanitized hostname, Workers Builds prints the URL). One PR into `dev`.

## Context References

Verified while planning (file:line as of `38c6c29`):

- `src/content.config.ts:20-74` — `tour2026` schema (glob loader `./src/content/tour2026`, `image()` fields). `export const collections = { blog, tour2026 }` at line 76: add the new collections there.
- `src/pages/programacion/[slug].astro` — es pages filter ids with `!d.id.endsWith("en") && !d.id.endsWith("fr")`; `src/pages/en/program/[slug].astro` filters `d.id.endsWith("en")` and strips `/\.?en$/` for the slug; fr mirrors it. Glob ids for `santa-marta.en.md` therefore end in `en` (with or without a dot); the new helper must accept both forms.
- `src/pages/{programacion,en/program,fr/programme}/index.astro` — 3-line wrappers around `ProgramacionIndexTemplate` with `lang`.
- `src/templates/ProgramacionIndexTemplate.astro` — 1117 lines; nav array lines 85-91 (links `/programacion/santa-marta`, `/programacion/palenque`); destination card link line 253 builds `/programacion/${slug}`; `<Layout title={t("program.pageTitle")}>` line 122; `<Header navLinks={programNavLinks} ctaLink={programCta} />` line 123; `<Footer />` line 391. Full-height hero sits under the fixed header.
- `src/templates/ProgramacionSlugTemplate.astro` — 1111 lines; nav array lines 48-54; back link line 146 → `/programacion`; JSON-LD built lines 82-104 (pattern for the 2027 JSON-LD); Google Calendar helper hardcodes `202601` (2026 only, leave as is).
- `src/components/Header.astro:24-53` — default nav: dropdown "AFRO IN Tour" with `/programacion`, `/programacion/santa-marta`, `/programacion/palenque`, `/artistas`; props `navLinks`, `ctaLink`. Header is `fixed` with `h-20` (80 px): new pages need `padding-top: 80px` (or a hero that starts below it).
- `src/templates/TiendaIndexTemplate.astro:30-45`, `src/templates/TiendaSlugTemplate.astro:31-46`, `src/templates/ArtistasTemplate.astro:82-90` — copies of the nav array with the two stop links.
- `src/layouts/Layout.astro` — Props `title, description, image, canonicalURL, noindex`; Google Fonts `<link>` lines 220-233 (Outfit + Inter, print/onload trick); `<ClientRouter />` line 234; only a default `<slot />` (line 237, in `<body>`): no head slot exists.
- `src/i18n/utils.ts:37-90` — `getTranslatedPath` maps `/programacion/<suffix>` ↔ `/en/program/<suffix>` ↔ `/fr/programme/<suffix>` keeping the suffix, so `/programacion/2027/santa-marta` → `/en/program/2027/santa-marta` and hreflang in `Layout.astro` stays correct without route changes.
- `src/i18n/locales/{es,en,fr}.json` — flat keys; `program.*` and `programSlug.*` (es lines 191-213) belong to the 2026 templates: new keys use the prefix `edition.`.
- `tests/checkout-fields.test.ts` — test pattern: `node:test` + `node:assert/strict`, imports `../src/lib/<file>.ts`. Execution report d8: tested modules import siblings with `.ts` extensions and no `@/` alias.
- `package.json` scripts: `test` = `node --experimental-strip-types --test "tests/**/*.test.ts"`, `check` = `astro build && tsc && wrangler deploy --dry-run`, `dev` = `astro dev`. No lint script.
- `astro.config.mjs:15-16` — `site: "https://afroin.org"`, `output: "static"`; no `redirects` key today.
- `public/_headers` exists; no `public/_redirects`.
- Existing assets: `src/assets/img/aliados/la-puerta.webp`, `src/assets/img/aliados/masaya.webp` (venue logos). Co·KoA logo is not in the repo (source: `/Users/juliochemoreno/Pictures/Afro In/2027/IMG_8951.png`, 795×285).

Platform claim — redirects. Command: `sed -n 232,300p node_modules/@astrojs/cloudflare/dist/index.js`. Output (excerpt): on `astro:build:done` the adapter runs `createRedirectsFromAstroRoutes(...)` over routes of `type === "redirect"` and `appendFile(new URL("./_redirects", outDir), printAsRedirects(trueRedirects))`. So Astro `redirects` config entries end up in `dist/_redirects`, which Workers Static Assets serve as real redirects. Still unproven on the deployed Preview: Task 1 checks `dist/_redirects` at build time and Level 4b checks `curl -sI` on the Preview (fallback below).

Dependents search. Command: `grep -rln "programacion/\|/program/\|/programme/\|tour2026" src | grep -v src/content/tour2026`. Output (11 files): `src/content.config.ts`, `src/components/Header.astro`, `src/components/Events.astro`, `src/templates/TiendaIndexTemplate.astro`, `src/templates/ProgramacionIndexTemplate.astro`, `src/templates/TiendaSlugTemplate.astro`, `src/templates/ArtistasTemplate.astro`, `src/templates/ProgramacionSlugTemplate.astro`, `src/pages/programacion/[slug].astro`, `src/pages/fr/programme/[slug].astro`, `src/pages/en/program/[slug].astro`. `Events.astro` only links `/programacion` (line 113, still valid) — no task. `ArtistasTemplate.astro` reads `tour2026` for its own content (out of scope) and its nav links get Task 3. Every other file has a task.

Data audit (2027 content): source is Julio's images, summarized in the spec. Null cases: Palenque days have activities but no venue and no times; Robe L Ninho's activities have no time; Fri 15 has a venue and no activities; two artists (Eirini Tsiakka, Fideles Cadito) have no activity at all; only Santa Marta has `tickets`; the battle has no `signupUrl`. Two activities share 4:00 pm on Sun 17: render in content order.

## Domain Assumptions

- A stop whose days all have zero activities is "coming soon": the listing link reads "Programación muy pronto" and the stop page shows one "Programación por anunciar" block instead of empty day cards — confirm.
- A day with a venue but no activities shows its day card plus "Programación por anunciar" — confirm.
- An artist's line on the listing shows the first activity that references them ("16 ene · Co·KoA"); an artist referenced by no activity shows "Fecha por anunciar" — confirm.
- The nav dropdown "Santa Marta" / "Palenque" entries mean "current edition" and point to 2027, including inside the 2026 pages' own nav arrays — confirm.
- The ticket tiers ($20.000 / $35.000 / $45.000 COP) belong to Santa Marta (classes and show of Robe L Ninho, Co·KoA bar and Masaya) and are shown as information only, with no highlight of the current tier (pages are static; a date highlight would go stale) — confirm.
- Artist photos are the poster crops shown in the mockup, committed as optimized JPGs (≈90 KB each) until the clean PNGs arrive — confirm.

## Requirements Delta

See spec: .agents/specs/2026-10-27-programacion-2027.md

### ADDED Requirements
- REQ-PROGRAM-001: Current edition listing
  - Scenario: listing — Given the 2027 content, When a visitor opens `/programacion` (or `/en/program`, `/fr/programme`), Then they see AFRO IN 2027 with both stops, their dates, the guest artists and a link to the 2026 edition.
- REQ-PROGRAM-002: Stop page with daily agenda
  - Scenario: agenda — Given Santa Marta 2027, When a visitor opens `/programacion/2027/santa-marta`, Then they see Fri 15, Sat 16 and Sun 17 with venue and activities, and "Programación por anunciar" for Fri 15.
- REQ-PROGRAM-003: Past edition archive
  - Scenario: archive — Given the 2026 content, When a visitor opens `/programacion/2026/palenque`, Then the page looks as `/programacion/palenque` did before this change.
  - Scenario: old link — Given a bookmark to `/programacion/santa-marta`, When it is opened, Then the response is a 301 to `/programacion/2026/santa-marta`.

## Implementation Tasks

> Phase boundaries: see `## Phase Boundaries` after the tasks.

### Task 1: Move the 2026 pages under `/2026/` and add redirects
- **Action:** create + modify + delete
- **File:** `src/pages/programacion/2026/index.astro`, `src/pages/programacion/2026/[slug].astro`, `src/pages/en/program/2026/index.astro`, `src/pages/en/program/2026/[slug].astro`, `src/pages/fr/programme/2026/index.astro`, `src/pages/fr/programme/2026/[slug].astro` (create); `src/pages/{programacion,en/program,fr/programme}/[slug].astro` (delete, via `git mv` into `2026/`); `astro.config.mjs` (modify)
- **Pattern:** the existing `[slug].astro` and `index.astro` wrappers (unchanged code, new location).
- **Details:**
  1. `git mv src/pages/programacion/[slug].astro src/pages/programacion/2026/[slug].astro` and the same for en and fr (content unchanged).
  2. Create `2026/index.astro` in the three languages with the exact content of today's `index.astro` (`<ProgramacionIndexTemplate lang="…" />`). The top-level `index.astro` files change in Task 9.
  3. Add to `astro.config.mjs` (inside `defineConfig`): `redirects` with 9 entries: `/programacion/santa-marta` → `/programacion/2026/santa-marta`, `/programacion/palenque` → `/programacion/2026/palenque`, the same 2 for `/en/program/…` and `/fr/programme/…`, plus `/programacion/2027` → `/programacion`, `/en/program/2027` → `/en/program`, `/fr/programme/2027` → `/fr/programme`. Use the object form `{ status: 301, destination: "…" }`.
- **Gotcha:** with `i18n.routing.prefixDefaultLocale: false`, write full paths (no locale magic). A redirect source must not collide with a generated page: `/programacion/2027` has no `index.astro` (only `2027/[slug].astro`, Task 9).
- **Validate:** `npm run build && cat dist/_redirects` lists the 9 rules with `301`; `ls dist/programacion/2026 dist/en/program/2026 dist/fr/programme/2026` shows `index.html`, `santa-marta/`, `palenque/`.
- **Time-box:** 30 min. If `dist/_redirects` is not generated, write `public/_redirects` by hand with the same 9 lines (`<from> <to> 301`) and drop the config entries.

### Task 2: Point the 2026 templates' internal links to `/2026/`
- **Action:** modify
- **File:** `src/templates/ProgramacionIndexTemplate.astro`, `src/templates/ProgramacionSlugTemplate.astro`
- **Pattern:** existing `getTranslatedPath(...)` calls in the same files.
- **Details:** index line 253: `/programacion/${slug}` → `/programacion/2026/${slug}`. Slug line 146 (back link): `/programacion` → `/programacion/2026`. Nav arrays (index 85-91, slug 48-54): the two stop links → `/programacion/2027/santa-marta` and `/programacion/2027/palenque`; `/programacion` stays. Nothing else changes (look must stay identical).
- **Gotcha:** do not touch styles or copy; Level 5 compares these pages before/after.
- **Validate:** `grep -n "getTranslatedPath(\`/programacion\|getTranslatedPath(\"/programacion" src/templates/Programacion*Template.astro` shows only `/programacion`, `/programacion/2026…` and `/programacion/2027/…` targets.

### Task 3: Update the nav dropdown links to the 2027 stops
- **Action:** modify
- **File:** `src/components/Header.astro`, `src/templates/TiendaIndexTemplate.astro`, `src/templates/TiendaSlugTemplate.astro`, `src/templates/ArtistasTemplate.astro`
- **Pattern:** the nav arrays at the lines listed in Context References.
- **Details:** replace `/programacion/santa-marta` → `/programacion/2027/santa-marta` and `/programacion/palenque` → `/programacion/2027/palenque` (labels unchanged).
- **Gotcha:** `ArtistasTemplate.astro` also reads `tour2026` (line 22) for its content: leave that.
- **Validate:** `grep -rn "programacion/santa-marta\|programacion/palenque" src` returns no lines outside `src/content/`.

### Task 4: Add `src/lib/programacion.ts` (pure helpers) with tests
- **Action:** create
- **File:** `src/lib/programacion.ts`, `tests/programacion.test.ts`
- **Pattern:** `src/lib/checkoutFields.ts` + `tests/checkout-fields.test.ts` (node:test, `.ts` imports, no `@/`).
- **Details:** export:
  - `type Lang = "es" | "en" | "fr"`.
  - `entryLang(id: string): Lang` — `en` if the id ends with `en` (with or without a dot), `fr` likewise, else `es`. `baseSlug(id: string): string` strips a trailing `.en`/`en`/`.fr`/`fr` exactly as the current `[slug].astro` files do.
  - `parseIsoDate(iso: string): Date` — `YYYY-MM-DD` as UTC midnight; throws on another shape.
  - `dayLabel(iso, lang)` → `{ weekdayLong, weekdayShort, dayMonth, dayNumber }` using `Intl.DateTimeFormat(locale, { timeZone: "UTC", … })` with locales `es-CO`, `en-US`, `fr-FR`; weekday capitalized (es/fr come lowercase). Expected: `dayLabel("2027-01-15","es")` → weekdayLong "Viernes", weekdayShort "Vie", dayMonth "15 de enero", dayNumber "15"; en → "Friday", "Fri", "January 15"; fr → "Vendredi", "Ven", "15 janvier". Strip the trailing period some runtimes add to short weekdays ("vie." → "Vie").
  - `dateRange(startIso, endIso, lang)` → es "15 – 17 de enero", en "January 15 – 17", fr "15 – 17 janvier"; when months differ, both ends carry their month ("30 de enero – 2 de febrero").
  - `joinList(items: string[], lang)` → `Intl.ListFormat` conjunction ("A, B y C" / "A, B, and C" / "A, B et C").
  - `isComingSoon(days: { activities: unknown[] }[]): boolean` — true when `days` is empty or every day has zero activities.
  - `formatCop(amount: number, lang)` → `Intl.NumberFormat(locale, { style: "currency", currency: "COP", maximumFractionDigits: 0 })` (es "$ 20.000" or "$20.000" as ICU prints it; tests assert digits and grouping, not the exact space).
  - `firstAppearance(artistId, days)` → `{ date, venue } | undefined` — first day (in array order) whose activities reference `artistId`.
- **Gotcha:** never `new Date("2027-01-15")` in local time (Bogotá is UTC−5 and shifts the day); always UTC. Node's ICU output must match what Workers/Astro build use: the build runs in Node, pages are prerendered, so tests in Node are representative.
- **Validate:** `node --experimental-strip-types --test tests/programacion.test.ts` passes with cases for each export (including both id forms, a cross-month range, empty days, an artist with no activity).

### Task 5: Add the `tour2027` and `artists2027` collections
- **Action:** modify
- **File:** `src/content.config.ts`
- **Pattern:** `tour2026` (same file, lines 20-74).
- **Details:**
  - `artists2027`: glob `./src/content/artists2027`, `**/*.md`; schema `({ image }) => z.object({ name: z.string(), country: z.object({ es: z.string(), en: z.string(), fr: z.string() }), photo: image(), order: z.number() })`.
  - `tour2027`: glob `./src/content/tour2027`, `**/*.{md,mdx}`; schema `({ image }) => z.object({ name, startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate (same), location: z.string(), order: z.number(), intro: z.string(), days: z.array(z.object({ date (ISO regex), venue: z.string().optional(), venueArea: z.string().optional(), venueLogo: image().optional(), mapUrl: z.string().url().optional(), activities: z.array(z.object({ time: z.string().optional(), title: z.string(), kind: z.string().optional(), artist: reference("artists2027").optional(), signupUrl: z.string().url().optional(), note: z.string().optional() })) })), tickets: z.object({ tiers: z.array(z.object({ period: z.string(), price: z.number().int().positive(), note: z.string().optional() })).min(1), includes: z.string().optional() }).optional() })`.
  - Export both in `collections`.
- **Gotcha:** `reference` comes from `astro:content`. A typo in an artist id must fail the build (that is why `reference` is used).
- **Validate:** after Task 6, `npx astro sync` exits 0.

### Task 6: Add the 2027 content and images
- **Action:** create
- **File:** `src/content/artists2027/{chichi-banana,choco,filtro-fafoman,eirini-tsiakka,robe-l-ninho,fideles-cadito}.md`, `src/content/tour2027/{santa-marta,santa-marta.en,santa-marta.fr,palenque,palenque.en,palenque.fr}.md`, `src/assets/img/2027/artistas/*.jpg`, `src/assets/img/aliados/cokoa.png`
- **Pattern:** `src/content/tour2026/santa-marta.md` (frontmatter-only Markdown, relative image paths `../../assets/img/...`).
- **Details:**
  - Images (ImageMagick is installed: `/opt/homebrew/bin/magick`), source folder `/Users/juliochemoreno/Pictures/Afro In/2027` (top-level files = latest versions), output 640 px wide, quality 78:
    - `magick "<src>/Afiche AFRO INTROSPECCION-3.png" -crop 700x875+430+640 +repage -resize 640x -quality 78 src/assets/img/2027/artistas/chichi-banana.jpg`
    - `6.png` `900x1125+330+520` → `choco.jpg`; `Afiche AFRO INTROSPECCION-6.png` `640x800+480+600` → `filtro-fafoman.jpg`; `Afiche AFRO INTROSPECCION-15.png` `640x800+500+560` → `eirini-tsiakka.jpg`; `2.png` `680x850+470+560` → `robe-l-ninho.jpg`; `3.png` `600x750+480+720` → `fideles-cadito.jpg`.
    - `magick "<src>/IMG_8951.png" -resize 400x src/assets/img/aliados/cokoa.png`.
  - Artists (order = listing order): Chichi Banana (Francia / France / France) 1; Choco (Venezuela ×3) 2; Filtro Fafoman (Colombia ×3) 3; Eirini Tsiakka (Chipre / Cyprus / Chypre) 4; Robe L Ninho (Cuba ×3) 5; Fideles Cadito (Reino Unido / United Kingdom / Royaume-Uni) 6.
  - Santa Marta (es; en/fr translate `name` only where needed, `intro`, `kind`, `note`): `name: "Santa Marta"`, `startDate: "2027-01-15"`, `endDate: "2027-01-17"`, `location: "Santa Marta, Magdalena"`, `order: 1`, `intro: "Primera parada de AFRO IN 2027: tres días de música, baile y batallas en tres casas aliadas de la ciudad."`. Days: `2027-01-15` venue "Oh la la! La Puerta", venueArea "Santa Marta", venueLogo `la-puerta.webp`, activities `[]`; `2027-01-16` "Co·KoA Conceptstore", logo `cokoa.png`, activity `{ time: "4:00 pm", title: "Chichi Banana", kind: "Artista invitado", artist: chichi-banana }`; `2027-01-17` "Masaya", logo `masaya.webp`, activities `{ time: "4:00 pm", title: "Choco", kind: "Artista invitado", artist: choco }` and `{ time: "4:00 pm", title: "Afro Batalla", kind: "Coupé décalé 1 vs 1", artist: filtro-fafoman, note: "Inscripciones muy pronto" }`.
  - Robe L Ninho on Santa Marta (Julio, 2026-10-28: classes and show on the 16th at Co·KoA and the 17th at Masaya, time to be confirmed): add to `2027-01-16` and to `2027-01-17` the activity `{ title: "Clases y show de Robe L Ninho", kind: "Artista invitado", artist: robe-l-ninho }` with no `time` (renders "edition.timeTba"), placed after the timed activities.
  - Santa Marta `tickets` (es; Julio's text, 2026-10-28; prices in COP): `{ tiers: [ { period: "1 al 15 de noviembre", price: 20000, note: "Primeras 50 boletas, solo con registro en afroin.org" }, { period: "16 de noviembre al 16 de diciembre", price: 35000, note: "Preventa, 150 boletas" }, { period: "Desde el 17 de diciembre", price: 45000, note: "150 boletas" } ], includes: "Incluye las clases y el show de Robe L Ninho. Cupo limitado en Co·KoA bar y Masaya." }`; en/fr translate `period`, `note`, `includes`.
  - Palenque (Julio, 2026-10-28; starts on the 17th while Santa Marta still runs — correct): `name: "Palenque de Benkos"`, `startDate: "2027-01-17"`, `endDate: "2027-01-20"`, `location: "San Basilio de Palenque, Bolívar"`, `order: 2`, `intro: "Segunda parada de AFRO IN 2027, en San Basilio de Palenque: fiesta en el arroyo, clases de baile para niños, niñas y jóvenes palenqueros, y el cierre del festival."`. Days (no venue, no times): `2027-01-17` `{ title: "Fiesta en el arroyo", kind: "Fiesta" }`; `2027-01-18` and `2027-01-19` `{ title: "Clases de baile con los instructores internacionales", kind: "Taller", note: "Para niños, niñas y jóvenes de Palenque" }`; `2027-01-20` `{ title: "Cierre AFRO IN Palenque", kind: "Cierre" }`. en/fr translate title, kind, note, intro.
  - en/fr intros: translate the es text faithfully (Julio reviews on the Preview). Times: en "4:00 pm", fr "16 h 00". Kinds: en "Guest artist", fr "Artiste invité·e"; note en "Registration opens soon", fr "Inscriptions bientôt ouvertes".
- **Gotcha:** the posters themselves are not committed (orchestrator: decide which go and optimize first) — only the six crops and the Co·KoA logo. Keep each JPG under ~150 KB.
- **Validate:** `npx astro sync` exits 0; `ls -la src/assets/img/2027/artistas` shows 6 files, each < 150 KB.

### Task 7: Allow page-specific `<head>` content in the layout
- **Action:** modify
- **File:** `src/layouts/Layout.astro`
- **Pattern:** the existing Google Fonts `<link>` block (lines 220-233).
- **Details:** add `<slot name="head" />` inside `<head>`, right after the fonts block and before `<ClientRouter />`. No other change.
- **Gotcha:** pages that pass nothing render exactly as before (empty named slot).
- **Validate:** `git diff --stat src/layouts/Layout.astro` shows exactly 1 insertion; `npm run build` succeeds.

### Task 8: Create the 2027 templates
- **Action:** create
- **File:** `src/templates/Edition2027IndexTemplate.astro`, `src/templates/Edition2027StopTemplate.astro`
- **Pattern:** `ProgramacionIndexTemplate.astro` / `ProgramacionSlugTemplate.astro` for the frame (`Layout` + `Header navLinks ctaLink` + `Footer`, nav arrays, `getTranslatedPath`, `useTranslations`, JSON-LD via `<script type="application/ld+json" set:html>`); the approved mockup files for markup and tokens (`Main.dc.html`, `Evento.dc.html` in the artifact; the spec lists the tokens).
- **Details:**
  - Both: `<Fragment slot="head">` with the Anton font (`https://fonts.googleapis.com/css2?family=Anton&display=swap`, same print/onload + noscript pattern as `Layout.astro`). Root `<main class="festival">` with `padding-top: 80px` (fixed header), CSS custom properties for the tokens (`--night #07120D`, `--jungle #123326`, `--jungle-2 #1A4A35`, `--gold #F2C14E`, `--cream #F4EAD5`, `--muted #C9BFA8`, `--heliconia #E8742A`, `--teal #47C1B0`; red = `var(--color-primary)`), `.display { font-family: "Anton", "Outfit", sans-serif; font-weight: 400 }`. Content width `max-width: 1200px`, side padding 40 px, 16 px under 720 px. Nav arrays: same as Task 2/3 (2027 stop links). CTA = `/#unirse` "nav.join".
  - Index: read `tour2027` (filter `entryLang(id) === lang`, sort `order`) and `artists2027` (sort `order`). Sections per spec: hero ("edition.tagline", "AFRO IN" in red + "2027" in gold, 184 px desktop / 88 px mobile); framed stops grid (2 columns, 1 under 720 px; each card: `dateRange`, name, venues line = `joinList(unique venues)` or `location` when none, link label "edition.viewProgram" or "edition.comingSoon" when `isComingSoon`; href `getTranslatedPath(\`/programacion/2027/${baseSlug(id)}\`, lang)`); artists grid (3 columns, 2 under 720 px; `<Image>` 4:5 `object-fit: cover`, `widths={[320, 640]}`, gold outline offset 5 px; name; `country[lang]` + " · " + first appearance (`dayLabel(...).dayMonth` + ", " + venue) or "edition.dateTba"); the same tickets block as the stop page for each stop with `tickets` (heading "edition.ticketsTitle" + " · " + stop name), placed between the stops frame and the artists; "Edición 2026" band linking `getTranslatedPath("/programacion/2026", lang)`.
  - Stop: props `entry`, `lang`, `allStops` (for "next stop"). Hero (back link "edition.backToEdition" → listing; `dateRange` + year in gold; name 168 px / 96 px mobile; `intro`; day jump links `#d-<dayNumber>` labelled `weekdayShort + " " + dayNumber`, only when not coming soon). If `isComingSoon(days)`: one block "edition.agendaTba" + "edition.agendaTbaText". Else one `<section id="d-<n>">` per day: framed card (heart SVG, red on odd index / teal on even; `weekdayLong`; `dayMonth`; venue logo 56 px circle on cream when present + venue + venueArea) and activities (time in gold Anton, artist photo 96 px — hidden under 720 px —, `kind` in heliconia, title in Anton, artist line `name (country)` when the artist is not the title, `note` in muted, a red "edition.signup" link only when `signupUrl` exists); an empty day shows "edition.agendaTba"; an activity without `time` shows "edition.timeTba" in the time column; each day section has `scroll-margin-top: 96px` (fixed header). Tickets block, only when the stop has `tickets` (Santa Marta): title "edition.ticketsTitle", one row per tier (period, `formatCop(price)` in gold Anton, note), `includes`, and "edition.ticketsSoon" (no buy button, no link: information only, Julio 2026-10-28). Next stop band (next by `order`, if any). JSON-LD `Event`: name `AFRO IN 2027 – ${name}`, `startDate`, `endDate`, `eventStatus` scheduled, `location` Place `{ name: location, address: { addressLocality: name, addressCountry: "CO" } }`, `performer` = referenced artists as `Person`, organizer AFRO IN. `<Layout title="{name} · AFRO IN 2027" description={intro}>`.
  - Accessibility: real `<a>` links, `aria-label` on the day nav, decorative SVG `aria-hidden`, artist `<Image alt={name}>`, venue logo `alt=""` (name is next to it), focus visible on gold links (`outline: 2px solid var(--gold)`), text contrast as in the mockup.
- **Gotcha:** rule 4 — pages are static (no `server:defer`, no `prerender = false`); `astro:assets` `<Image>` is fine because they prerender. Resolve artist references with `getEntry` (or `getEntries`) at build time. Astro scoped styles: use classes defined in the same component.
- **Validate:** `npm run build` succeeds; `grep -c "AFRO IN 2027" dist/programacion/2027/santa-marta/index.html` ≥ 1.

### Task 9: Wire the 2027 pages
- **Action:** create + modify
- **File:** `src/pages/programacion/2027/[slug].astro`, `src/pages/en/program/2027/[slug].astro`, `src/pages/fr/programme/2027/[slug].astro` (create); `src/pages/programacion/index.astro`, `src/pages/en/program/index.astro`, `src/pages/fr/programme/index.astro` (modify)
- **Pattern:** the moved `2026/[slug].astro` files.
- **Details:** `getStaticPaths` reads `tour2027`, keeps `entryLang(id) === "<lang>"`, `params: { slug: baseSlug(id) }`, `props: { entry, allStops }` (same-language stops); render `<Edition2027StopTemplate entry={entry} allStops={allStops} lang="<lang>" />`. Index files render `<Edition2027IndexTemplate lang="<lang>" />`.
- **Gotcha:** the template imports `programacion.ts` with the `@/lib/programacion` alias (Astro side); only the test file uses the relative `.ts` import.
- **Validate:** `npm run build` then `ls dist/programacion/2027 dist/en/program/2027 dist/fr/programme/2027` each show `santa-marta/` and `palenque/`.

### Task 10: Add the UI strings
- **Action:** modify
- **File:** `src/i18n/locales/es.json`, `src/i18n/locales/en.json`, `src/i18n/locales/fr.json`
- **Pattern:** flat keys as in the same files.
- **Details:** keys (es / en / fr):
  - `edition.tagline`: "Festival de cultura afro en el Caribe colombiano" / "Afro culture festival in the Colombian Caribbean" / "Festival de culture afro dans les Caraïbes colombiennes"
  - `edition.pageTitle`: "Programación AFRO IN 2027" / "AFRO IN 2027 Program" / "Programme AFRO IN 2027"
  - `edition.viewProgram`: "Ver la programación" / "See the program" / "Voir le programme"
  - `edition.comingSoon`: "Programación muy pronto" / "Program coming soon" / "Programme très bientôt"
  - `edition.artistsTitle`: "Artistas invitados" / "Guest artists" / "Artistes invité·e·s"
  - `edition.artistsText`: "Llegan desde seis países para bailar, enseñar y compartir escenario con la comunidad." / "They come from six countries to dance, teach and share the stage with the community." / "Ils et elles viennent de six pays pour danser, enseigner et partager la scène avec la communauté."
  - `edition.dateTba`: "Fecha por anunciar" / "Date to be announced" / "Date à venir"
  - `edition.pastTitle`: "Edición 2026" / "2026 edition" / "Édition 2026"
  - `edition.pastText`: "La gira de enero de 2026 por Santa Marta y Palenque, tal como la publicamos." / "The January 2026 tour of Santa Marta and Palenque, as we published it." / "La tournée de janvier 2026 à Santa Marta et Palenque, telle que publiée."
  - `edition.pastLink`: "Ver la edición 2026" / "See the 2026 edition" / "Voir l'édition 2026"
  - `edition.backToEdition`: "Programación 2027" / "2027 program" / "Programme 2027"
  - `edition.days`: "Días" / "Days" / "Jours"
  - `edition.agendaTba`: "Programación por anunciar" / "Program to be announced" / "Programme à venir"
  - `edition.agendaTbaText`: "Publicaremos horarios y artistas muy pronto." / "We will publish times and artists very soon." / "Nous publierons les horaires et les artistes très bientôt."
  - `edition.signup`: "Inscribirme" / "Sign up" / "M'inscrire"
  - `edition.nextStop`: "Siguiente parada" / "Next stop" / "Prochaine étape"
  - `edition.viewStop`: "Ver {name}" / "See {name}" / "Voir {name}" (replace `{name}` in the template)
  - `edition.timeTba`: "Hora por anunciar" / "Time TBA" / "Heure à venir"
  - `edition.ticketsTitle`: "Entradas" / "Tickets" / "Billets"
  - `edition.ticketsSoon`: "Venta en línea muy pronto en afroin.org." / "Online sales coming soon at afroin.org." / "Vente en ligne très bientôt sur afroin.org."
- **Gotcha:** `useTranslations` types keys from `es.json`: add every key to all three files or `tsc` fails.
- **Validate:** `node -e "for (const l of ['es','en','fr']) { const j=require('./src/i18n/locales/'+l+'.json'); const k=Object.keys(j).filter(x=>x.startsWith('edition.')); console.log(l,k.length) }"` prints 20 for each.

## Phase Boundaries

1. **Commit A — archive 2026 (Tasks 1–3):** `feat(programacion): move 2026 edition under /2026 with redirects`. Tests in this commit: none new (existing `npm test` stays green). Rollback: revert the commit.
2. **Commit B — 2027 data (Tasks 4–6, 10):** `feat(programacion): add 2027 content, collections and date helpers`. Tests: `tests/programacion.test.ts` (green at this commit). Rollback: revert.
3. **Commit C — 2027 pages (Tasks 7–9):** `feat(programacion): 2027 festival-style listing and stop pages`. Tests: none new. Rollback: revert (the 2026 archive from A keeps working; `/programacion` would then 404 until A is also reverted — revert C and A together if needed).

## Interaction Matrix

| Action | Context | Expected Behavior |
|--------|---------|-------------------|
| Click a stop card | Listing | Opens `/programacion/2027/<slug>` in the same language |
| Click "Ver la edición 2026" | Listing | Opens `/programacion/2026` (old design) |
| Click a day link ("Sáb 16") | Stop page | Scrolls to that day's section; the fixed header does not cover its title (`scroll-margin-top: 96px`) |
| Tab through the page | Any 2027 page | Focus visible (gold outline) on every link in DOM order: header, back link, day links, stop/next links, footer |
| Open an old 2026 URL | `/programacion/santa-marta`, `/en/program/palenque`, … | 301 to the `/2026/` URL, page in its old design |
| Open `/programacion/2027` | — | 301 to `/programacion` |
| Switch language | Stop page | Language switcher lands on the same stop in the other language |
| Coming-soon stop | a stop whose days have no activities (none today; kept for future editions) | Hero + one "Programación por anunciar" block, no day links |
| Activity without time | Palenque days, Robe L Ninho | "Hora por anunciar" in the time column |
| Narrow screen | < 720 px | Stops stacked, 2-column artists, activity photos hidden, no horizontal scroll at 375 px |

## Test Tasks

- Task 4 creates `tests/programacion.test.ts` (labels per language, UTC handling, ranges, list join, coming-soon, first appearance, both id forms).
- Regression smoke after Commit C: the 2026 pages (`/programacion/2026`, `/programacion/2026/santa-marta`, en/fr) render with the old design; the store pages' nav dropdown links resolve (curl matrix below).

## Validation Checklist

- [ ] **Level 1 — Lint & Format:** no lint script in this project (`package.json`); skip.
- [ ] **Level 2 — Type Check:** `npm run check` (astro build + tsc + wrangler deploy --dry-run).
- [ ] **Level 2.5 — Code Review:** run the `code-review` skill on the changed files; save the report under `.agents/code-reviews/d9-programacion-2027.md`.
- [ ] **Level 3 — Unit Tests:** `npm test`.
- [ ] **Level 4a — curl matrix against `astro dev`** (not `wrangler dev`): start `npx astro dev --port 4321` in the background; each of these returns 200: `/programacion`, `/en/program`, `/fr/programme`, `/programacion/2027/santa-marta`, `/programacion/2027/palenque`, `/en/program/2027/santa-marta`, `/fr/programme/2027/palenque`, `/programacion/2026`, `/programacion/2026/santa-marta`, `/en/program/2026/palenque`, `/fr/programme/2026/santa-marta`, `/tienda`. `curl -s localhost:4321/programacion/2027/santa-marta | grep -c "Chichi Banana"` ≥ 1.
- [ ] **Level 4b — Preview redirects (after push):** `curl -sI https://<preview-host>/programacion/santa-marta` → `301` with `location: /programacion/2026/santa-marta`; same for `/en/program/palenque` and `/programacion/2027`. If any returns 200 with a meta refresh instead, apply Task 1's fallback (`public/_redirects`) and re-check.
- [ ] **Level 5 — Human Review (Julio, on the branch Preview, before the PR is merged into `dev`):**
  - Desktop and mobile (a real phone): `/programacion` and `/programacion/2027/santa-marta` match the approved mockup closely enough; `/programacion/2027/palenque` reads well as "coming soon".
  - en and fr versions: translated intros and labels read correctly (Julio corrects copy).
  - `/programacion/2026` and `/programacion/2026/santa-marta` look as the old pages did.
  - Content check: dates, venues, artists and countries match the posters.
  - If skipped: copy errors, translation mistakes or mobile layout problems ship unobserved to `dev` (and later production).

## Acceptance Criteria

- [ ] `/programacion`, `/en/program`, `/fr/programme` show AFRO IN 2027 with both stops, the six artists and the 2026 link.
- [ ] `/programacion/2027/santa-marta` (+ en/fr) shows Fri 15 (por anunciar), Sat 16 (Chichi Banana, 4 pm, Co·KoA) and Sun 17 (Choco and Afro Batalla, 4 pm, Masaya, "Inscripciones muy pronto").
- [ ] `/programacion/2027/palenque` (+ en/fr) shows 17–20 Jan: fiesta en el arroyo, two days of dance classes, closing; times "por anunciar".
- [ ] Santa Marta shows Robe L Ninho's classes and show on the 16th and 17th, and the listing and Santa Marta show the three ticket tiers as information (no purchase).
- [ ] `/programacion/2026/…` pages render with the old design; old URLs answer 301 on the Preview.
- [ ] Header and footer are the site's own; no new npm dependency.
- [ ] `npm test` and `npm run check` pass.

## Confidence Score: 8/10

- **Strengths:** static pages on existing patterns; routing helper already preserves suffixes; redirects path verified in the adapter source; content is small and known.
- **Uncertainties:** Workers Static Assets honoring the generated `_redirects` on the Preview; Node ICU short-weekday formats (period/case) per language; Anton loading through a new head slot with `ClientRouter` navigation.
- **Mitigations:** Level 4b with the `public/_redirects` fallback; tests pin the label output and the helper normalizes punctuation/case; the font uses the same link pattern as `Layout.astro`, and the fallback stack is Outfit.

## Notes for Executing Agent

- Read the spec and the mockup before Task 8. The mockup is the visual reference; tokens and sizes there are the target.
- Commit after each phase on the worktree branch (standing approval), push, open one PR into `dev` at the end; the orchestrator merges.
- Do not change the 2026 content or templates beyond the link edits in Task 2.
- Do not commit the original posters; only the crops and the Co·KoA logo from Task 6.
- Report to the orchestrator that the paid Afro Batalla registration is a new work item (Julio, 2026-10-28), and that home `Events.astro` and `/artistas` still show 2026.

> **UI Styling Note:** UI styling specifications (colors, sizes, variants, labels, spacing) are `[provisional]` proposals — expect them to change once the user sees the implementation. Implement as specified but do not over-invest in pixel-perfect adherence; plan for iteration.
>
> **Expected UX iterations: 3**
