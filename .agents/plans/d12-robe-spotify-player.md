# Plan: D12 — Robe L Ninho's Spotify player on the 2027 pages

## Overview
Embed the official Spotify artist player (compact, 152 px) in Robe L Ninho's headliner block on `/programacion` and in his panel on `/artistas` (es/en/fr), under his dates. The iframe loads lazily: a dark placeholder with a single "Escuchar" button sits in place, and the Spotify iframe is created only when the placeholder is near the viewport. No audio hosted by AFRO IN, no autoplay.

## Requirements Summary
- Decided by Julio (2026-10-28, 2026-11-01): artist https://open.spotify.com/artist/4zDDd9Y92qW2QH0DQ52rQW; both pages; under his dates (on the index: between the dates and the ticket block); compact player; loads when near the viewport; placeholder text = button only ("Escuchar a Robe L Ninho" / "Listen to Robe L Ninho" / "Écouter Robe L Ninho"), no extra title.
- Only Robe gets a player; the data lives in the artist's content entry so another artist can get one later by adding one field.
- Dark 2027 style (cream/gold), no gold boxed frame, no repeated info.
- Workflow classification: `async data-arrival`-free; one DOM observer (IntersectionObserver) → creates the iframe once.

## Out of Scope
- Hosting audio, autoplay, Spotify Web API / OAuth, play counts.
- Players for other artists, events pages (D23 owns `EventoSlugTemplate`, `EventosIndexTemplate`, ticket libs: do not touch).
- Cookie banner (the site has none; Spotify's iframe sets its own cookies only after it loads, which only happens near the section).
- Expected UX iterations: 2 (placeholder look, spacing beside tickets/dates on phone).

## Likely Follow-ups
- Players for other artists.
- Full-size player (352 px) variant.
- Click-only loading if Julio prefers more privacy.

## Git Strategy
- **Base branch:** `dev`
- **Feature branch:** `claude/d12-robe-spotify-f45f1e` (the session's worktree branch, already cut from `dev`)

## Context References
- `src/components/EditionHeadliner.astro` — the block used by both pages; has a default `<slot />` (`.fz-headliner-extra`, used for tickets on the index) and the dates `<ul class="fz-headliner-dates">`.
- `src/templates/Edition2027IndexTemplate.astro:175-200` — index usage; headliner comes from the content collection (`headliner.data` + `artistPhoto`).
- `src/templates/Artists2027Template.astro:50,71-83` — artists page; `headliner` is a mapped object (verify the new field survives the mapping at the top of the file, which builds `artists`).
- `src/content.config.ts:75-88` — `artists2027` zod schema (add the optional field here).
- `src/content/artists2027/robe-l-ninho.md` — Robe's entry (`featured: true`).
- `src/styles/festival.css:846-1012` — headliner styles; `.fz-headliner-extra` has a top border and `margin-top: 32px`; 1023px/720px breakpoints.
- `src/i18n/locales/{es,en,fr}.json` — `edition.*` keys (e.g. `edition.headliner`, line ~437 in es).
- `.agents/orchestrator.md` rules 10 (DOM scripts on `astro:page-load`), 11 (`100cqw`, not `100vw`).
- `tests/*.test.ts` run with `node --experimental-strip-types --test`; `npm test`, `npm run check`.

### Verified assumptions
- No CSP exists: `grep -rniE "content-security|frame-src|csp" src public astro.config.* wrangler.*` returned nothing; `public/_headers` only sets `X-Robots-Tag`, and `src/middleware.ts` only adds `X-Robots-Tag`. So the iframe from `open.spotify.com` is not blocked. If a CSP is ever added it needs `frame-src https://open.spotify.com`.
- Spotify embed URL shape: `https://open.spotify.com/embed/artist/<id>?utm_source=generator&theme=0`; iframe `allow="encrypted-media"` (Executing agent: confirm the URL loads in the Preview before Level 5; if the embed is refused in the Preview, report).

## Domain Assumptions
- The button text is exactly "Escuchar a Robe L Ninho" / "Listen to Robe L Ninho" / "Écouter Robe L Ninho" (name taken from the artist entry, verb from i18n) — confirmed by Julio as "solo Escuchar".
- Placeholder is a dark block, cream text, thin line like `.fz-headliner-extra` (no gold frame) — provisional, Julio sees it in Level 5.

## Implementation Tasks

### Task 1: Add the optional Spotify field to the artist schema and Robe's entry
- **Action:** modify
- **File:** `src/content.config.ts`, `src/content/artists2027/robe-l-ninho.md`
- **Pattern:** the existing optional `countryCode` field in the same schema
- **Details:** add `spotifyArtistId: z.string().regex(/^[A-Za-z0-9]{22}$/).optional()` to `artists2027`; set `spotifyArtistId: "4zDDd9Y92qW2QH0DQ52rQW"` in Robe's front matter.
- **Gotcha:** the id is public, not a secret. Validate the regex matches the 22-char id.
- **Validate:** `npx astro check` or `npm run check` parses the collection.

### Task 2: Pass the id through both templates
- **Action:** modify
- **File:** `src/templates/Artists2027Template.astro`, `src/templates/Edition2027IndexTemplate.astro` (not the events templates)
- **Pattern:** how `countryCode` reaches `EditionHeadliner` (index spreads `headliner.data`; artists page maps `artists`)
- **Details:** make sure `artist.spotifyArtistId` is present on the `artist` prop in both usages (index: already via `...headliner.data`; artists: add to the mapped object if fields are picked by name).
- **Gotcha:** the artists page repeats the block for every artist; the id is undefined for the others → no player.
- **Validate:** `grep -n spotifyArtistId src/templates/*.astro`; build shows the placeholder only on Robe.

### Task 3: Create the lazy player component
- **Action:** create
- **File:** `src/components/SpotifyPlayer.astro`
- **Pattern:** `src/components/EditionTickets.astro` (client script inside `astro:page-load`)
- **Details:** props `artistId`, `name`, `lang`. Markup: `<div class="fz-spotify" data-spotify-id=…>` containing a `<button type="button" class="fz-spotify-btn">` with the translated label (aria-label includes the name). Script: in `document.addEventListener("astro:page-load", …)` select every `.fz-spotify:not([data-ready])`; an `IntersectionObserver` with `rootMargin: "400px"` creates `<iframe src="https://open.spotify.com/embed/artist/{id}?utm_source=generator&theme=0" width="100%" height="152" loading="lazy" allow="encrypted-media; clipboard-write; fullscreen" title=…>` and replaces the button; clicking the button does the same immediately (also the fallback when IntersectionObserver is missing). Mark `data-ready`, disconnect the observer. No `autoplay`. Placeholder has the same 152 px height (no layout shift).
- **Gotcha:** ClientRouter re-runs `astro:page-load` on each navigation: guard with `data-ready` so a node is never initialised twice; disconnect observers if the node leaves the DOM. Do not use `100vw`.
- **Validate:** `npm run check`; in `astro dev` the iframe appears only after scrolling near the block (Network panel shows no `open.spotify.com` request before).

### Task 4: Render the player in the headliner under the dates
- **Action:** modify
- **File:** `src/components/EditionHeadliner.astro`
- **Pattern:** the dates block above it in the same file
- **Details:** after `.fz-headliner-dates` and before `.fz-headliner-extra`, render `<SpotifyPlayer>` when `artist.spotifyArtistId` is set (add it to the `artist` prop type). Index: sits between dates and the ticket block; /artistas: under the dates in his panel.
- **Gotcha:** `/artistas` panels are pinned (sticky) while text scrolls: confirm the player fits inside the panel at 1280×720 and on a 390 px phone without clipping.
- **Validate:** `npm run check`; screenshots at desktop and 390 px on both pages.

### Task 5: Styles and translations
- **Action:** modify
- **File:** `src/styles/festival.css`, `src/i18n/locales/es.json`, `en.json`, `fr.json`
- **Pattern:** `.fz-headliner-extra` / `.fz-headliner-dates` rules; `edition.headliner` key
- **Details:** add `edition.listen` = "Escuchar" / "Listen" / "Écouter" (component appends the artist name); `.fz-spotify` margin-top ≈ 24px (20px ≤720px), 152 px height, dark surface (`--fz-*` tokens), cream text, 1px `--fz-line`, radius matching the iframe (12px), focus-visible ring. No gold frame.
- **Gotcha:** use design tokens already in `festival.css`; no duplicate wording (the section already shows his name).
- **Validate:** `npm run check`; the three languages show their label.

### Task 6: Test the pure part
- **Action:** create
- **File:** `tests/spotify-embed.test.ts`, `src/lib/spotify.ts`
- **Pattern:** `tests/programacion.test.ts` + `src/lib/programacion.ts`
- **Details:** extract `spotifyEmbedUrl(id)` into `src/lib/spotify.ts` (returns the embed URL, throws/returns null on an invalid id); component and test use it. Tests: valid id → exact URL; invalid ids (empty, wrong length, `../x`) rejected.
- **Gotcha:** keep the lib free of Astro imports (Node test runner).
- **Validate:** `npm test`.

## Interaction Matrix
| Action | Context | Expected Behavior |
|--------|---------|-------------------|
| Scroll within ~400px | Placeholder not loaded | Iframe is created, button replaced, no autoplay |
| Click / Enter / Space | Button before load | Iframe created immediately |
| Navigate away and back (ClientRouter) | Any | Placeholder or iframe re-initialised once, no duplicates |
| No JS / no IntersectionObserver | Placeholder | Button still works through click |
| Tab key | Placeholder | Button is focusable with a visible ring |

## Test Tasks
Task 6 covers the URL builder. Regression: smoke `/programacion` and `/artistas` (ticket block still works: stage cards, "Comprar" links; sticky panels still pin) in es/en/fr.

## Validation Checklist
- [ ] **Level 1 — Lint & Format:** N/A (none configured in this project)
- [ ] **Level 2 — Type Check:** `npm run check`
- [ ] **Level 2.5 — Code Review:** `code-review` skill on the changed files
- [ ] **Level 3 — Unit Tests:** `npm test`
- [ ] **Level 4 — Integration:** `astro dev`: no `open.spotify.com` request until scrolled near the player; no console errors on `/programacion`, `/artistas` (es/en/fr)
- [ ] **Level 5 — Human Review:** Julio on a LOCAL `astro dev` server from this worktree (port 4323; 4321 is the main checkout, 4322 is D23), desktop and phone, before merge (Julio: everything local, a single production release at the end of the day, done by the orchestrator; this session stops at the PR to `dev`): placeholder look, player loads and plays only on his press, ticket block still intact, `/artistas` panel not clipped. If skipped, the embed ships unseen in production.

## Acceptance Criteria
- [ ] Robe's compact Spotify player appears under his dates on `/programacion` and `/artistas` in es/en/fr; other artists have none.
- [ ] No request to `open.spotify.com` until the block is near the viewport (or the button is pressed); never autoplays.
- [ ] No layout shift when the iframe replaces the placeholder.
- [ ] No gold frame, no repeated text; works on phone width.
- [ ] `npm run check` and `npm test` pass; D23's files untouched.

## Confidence Score: 8/10
- **Strengths:** small, isolated; no CSP; clear patterns for client scripts.
- **Uncertainties:** Spotify's embed behaviour inside sticky panels and on iOS; look of the placeholder.
- **Mitigations:** Level 5 on desktop and phone; 2 UX iterations budgeted.

## Notes for Executing Agent
UI styling is `[provisional]`. **Expected UX iterations: 2.** Do not touch `EventoSlugTemplate`, `EventosIndexTemplate` or ticket libs (D23). Never read `.env`.
