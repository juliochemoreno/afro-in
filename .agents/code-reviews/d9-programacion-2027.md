# Code review — D9 programación 2027 (branch claude/d9-redesign-programacion-b8d8eb)

Scope: `origin/dev...HEAD` (commits A–C). Level: high, 8 angles, no verify pass.

| # | File | Finding | Outcome |
|---|---|---|---|
| 1 | `src/lib/programacion.ts:11` | `entryLang`/`baseSlug` read the language from the glob id suffix, so a Spanish slug ending in "en"/"fr" (e.g. `carmen`) would be published as English and truncated. | Fixed: language and slug come from `entry.filePath` (`*.en.md`, `*.fr.md`); test covers `carmen.md`. |
| 2 | `src/templates/Edition2027StopTemplate.astro:24` | Year appended with a plain space ("15 – 17 de enero 2027", "January 17 – 20 2027"). | Fixed: `dateRange(..., { withYear: true })` → "de 2027" / ", 2027" / " 2027". |
| 3 | `src/lib/programacion.ts:47` | Ranges across two years printed no years. | Fixed: both ends carry their year; test added. |
| 4 | `src/templates/Edition2027StopTemplate.astro:54` | JSON-LD via `set:html` did not escape `<`. | Fixed: `<` → `<`. |
| 5 | `src/templates/Edition2027IndexTemplate.astro:57` | Nav arrays copied into both new templates (already duplicated in 4 older templates). | Skipped: pre-existing pattern across the site; a shared `programNav(lang)` belongs to a later D9 delivery. |
| 6 | `src/templates/Edition2027StopTemplate.astro:139` | Empty 96 px photo slot on activities without an artist (Palenque). | Skipped: keeps the columns aligned; revisit at Level 5 with Julio. |

Validation after fixes: `npm run check` ✅, `npm test` 20/20 ✅, build output shows the corrected date lines and JSON-LD.

## Final review (2026-10-28, fresh-context agent, scope `origin/dev...HEAD` after the draft iterations)

| # | File | Finding | Outcome |
|---|---|---|---|
| 1 | `src/templates/ProgramacionIndexTemplate.astro:298` | The 2026 listing's "view all artists" pointed to `/artistas`, now the 2027 page. | Fixed: `/artistas/2026`. |
| 2 | `src/components/EditionActivities.astro:41` | Stop pages went h1 → h2 (day) → h4 (activity), skipping h3. | Fixed: `headingLevel` prop; stop pages render activities as h3. |
| 3 | `src/content/tour2027/santa-marta*.md` | `venueLogo` / `mapUrl` are in the schema and content but nothing renders them. | No change: deliberate, Julio will send proper venue logos (2026-10-28). |
| 4 | `src/i18n/locales/*.json` | "six countries" / "six days" hardcoded while the numbers come from content. | Fixed: `{n}` placeholders filled from the content. |
| 5 | templates (3 places) | `#d-<dayNumber>` built in three places; same day number in two months would collide. | Fixed: `dayAnchor(iso)` → `d-YYYY-MM-DD` in `src/lib/programacion.ts` (tested); shared `artistIdOf`. |
| 6 | `src/components/FestivalScrolly.astro` | IntersectionObservers kept until the next page load after a ClientRouter navigation. | Fixed: disconnected on `astro:before-swap`. |

Validation after fixes: `npm run check` ✅, `npm test` 25/25 ✅, built HTML: 14 day links all resolve to existing `id`s, stop pages h2 → h3, 2026 listing links `/artistas/2026`.
