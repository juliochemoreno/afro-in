# Code review: d16-programacion-2027-update (final)

- Effort: high. Target: `origin/dev...HEAD` (87 files).
- Native review ran: yes. Project checklist (`.agents/guides/review-checklist.md`): not present; HOPLA checklist applied.
- Counts: kept 3, dropped 6.
- Verified clean: es/en/fr locale files have identical key sets (389 each); no literal `t()` key is missing in any locale; the dynamic `events.${key}.h${n}` keys exist for `sm` and `plk` in all three; every place that reads `artist.country`/`countryCode` guards for `undefined`; `activityArtistIds`, `activityByline` (no country) and `artistAppearances` are correct; no payment, ticketing or checkout code touched (SALES urls are empty placeholders); no secrets in the diff.

## Findings

severity: medium
confidence: 80
source: native
file: src/components/EditionTickets.astro
line: 50
issue: Price-stage script runs once per full page load; no `astro:page-load` listener although the layout uses `<ClientRouter />`.
detail: After a client-side navigation (e.g. /programacion to a stop page, or Santa Marta to Palenque) the new `[data-tiers]` list never gets `data-stage`; the "current stage", "ended" flags and buy button stay `hidden`. FestivalScrolly already uses `astro:page-load`.
suggestion: Wrap the body in a function and run it on `astro:page-load` (as `initScrolly` does).

severity: low
confidence: 85
source: native
file: src/content/artists2027/fideles-cadito.md
line: 10
issue: `fideles-cadito` and `dj-joe-kiz-vibes` both have `order: 6`; there is no `order: 4`.
detail: Artists page grid and alternating layout sort by `order`; a tie makes position depend on collection load order.
suggestion: Give unique orders (e.g. 4 for one of them).

severity: low
confidence: 80
source: native
file: src/components/Flag.astro
line: 24
issue: Flag SVG has `role="img"` and `aria-label={name}` even where the country name is printed next to it.
detail: Screen readers announce the country twice (EditionCountries, artist cards, headliner, bylines). The old emoji was `aria-hidden`.
suggestion: Add an optional `decorative` prop (or default to `aria-hidden="true"`) and keep the label only where the flag stands alone.

## Dropped (low confidence)

- src/templates/Edition2027StopTemplate.astro:62 — time per artist differs from index page (no `timeByArtist`); not reproducible with current content, the first activity of Palenque day 19 has no artist (confidence 40)
- src/components/Events.astro:28 — hard-coded slug to i18n key (`sm`/`plk`) and index-based badge; fine for two stops, latent for a third (confidence 60)
- src/components/FestivalScrolly.astro:150 — `show()` and DOM queries on every scroll event (confidence 55)
- src/components/EditionHeadliner.astro:37 — `getImage` for the mobile variant computed even when `portrait` (confidence 50)
- src/lib/programacion.ts:231 — `flagEmoji` and its test are now unused in `src/`; orphaned `*-art.webp` images and `edition.ticketsSoon` key (confidence 50)
- src/templates/Edition2027IndexTemplate.astro:66 — `placeOf` ignores `name`; "city of location" split repeated in three places (confidence 45)

## Outcome (fixes applied)

- `EditionTickets.astro:50` — fixed: stage logic now runs on `astro:page-load` (works after ClientRouter navigations).
- `fideles-cadito.md` / `dj-joe-kiz-vibes.md` order tie — fixed: unique `order` values (Joe 7, Acid Burrito 8, Afroneto 9).
- `Flag.astro:24` — fixed: the flag is decorative (`aria-hidden`), the name is always printed beside it; nothing is drawn for a code without a flag.
- Dropped items (confidence 40–60) left as they are; the unused leftovers (`flagEmoji`, two `*-art.webp`, `edition.ticketsSoon`) are noted for a later cleanup.
- Re-validation after the fixes: `npm run check` exit 0, `npm test` 32/32.
