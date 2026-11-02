# Code review: D17 home redesign

- Effort: high (native review) + HOPLA checklist pass
- Native review ran: yes (`code-review`, inline angles)
- Project checklist: none (`.agents/guides/review-checklist.md` does not exist); HOPLA checklist applied
- Kept: 4 · Dropped (low confidence): 3
- Validation after fixes: `npx tsc --noEmit` ✅ · `npm test` 120/120 ✅ · `npm run check` ✅

## Kept findings

severity: high
confidence: 95
source: native
file: src/components/Contact.astro
line: 62
issue: Contact form reused ids `name`/`message` that the donation form also uses on the same page.
detail: `getElementById("name")` in the contact script returned the donation form's input (first in the DOM), so the WhatsApp message lost the visitor's name and the label focused the wrong field. Pre-existing, re-exposed by the rewrite.
suggestion: Unique ids for the contact fields.
outcome: fixed — ids renamed to `contact-name` / `contact-message` (markup, labels and the two lookups in the script).

severity: medium
confidence: 85
source: native
file: src/components/FeaturedProducts.astro
line: 39
issue: Home product cards dropped the CMS badge ("Nuevo", "Popular") that ProductCard showed.
detail: Removed behaviour: a badge set in the admin no longer appeared on the home.
suggestion: Show the badge on the card.
outcome: fixed — badge shown top-left in a red square (replaces the category when present).

severity: medium
confidence: 80
source: native
file: src/components/Hero.astro
line: 20
issue: When `/api/contador` fails, the hero animates to the hard-coded default 12.847.
detail: `targetCount = 12847` is the SSR value and the catch() fallback; with the new goal bar the hero would state a count nobody reached. Pre-existing behaviour.
suggestion: Fall back to hiding the number (or "—") instead of a made-up figure.
outcome: skipped — pre-existing behaviour outside the plan; raised to Julio as a follow-up.

severity: low
confidence: 80
source: native
file: src/components/Hero.astro
line: 52
issue: Counter formatted with es-CO on the server and with the page language in the browser.
detail: On /en and /fr the separator flipped during load.
suggestion: One locale from `lang`, passed to the script.
outcome: fixed — `data-locale` from `lang` (es-CO / en-US / fr-FR) used by both.

## Dropped (low confidence)

- src/components/Registration.astro:499 — dark field styles duplicated with Contact.astro and EventoSlugTemplate.astro (confidence 60; cleanup, not a bug)
- src/components/Gallery.astro:88 — unplanned `data-category` on gallery items (confidence 50; harmless while filters stay hidden) — recorded as a deviation
- src/templates/UnirseTemplate.astro:10 — unused imports and `t` (confidence 50) — removed anyway

## Second pass (changes after Julio's local review)

Reviewed: festival pass block on the home (`EditionTickets` inside `Events.astro`, with its sticky buy bar, kept on purpose by Julio), product cards back to the old home layout in the dark style (`FeaturedProducts.astro`), input icons (`.hm-input-icon`), dark country/dial dropdowns via `:root:has(main.fz.home)`, documentary play pulse, store moved under the festival, stop-card copy (5 general lines per stop, from the 2027 programme).

- No new findings. `EditionTickets` keeps its own price-stage script (D20 endpoint), reused unchanged.
- `:has()` is needed because the dropdowns are portaled to `<body>`; browsers without `:has()` fall back to the light dropdown (still usable).
- Validation after the second pass: `npx tsc --noEmit` ✅ · `npm test` 120/120 ✅ · `npm run check` ✅
