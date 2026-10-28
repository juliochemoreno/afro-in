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
