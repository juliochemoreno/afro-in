# Code review — D21 lighter main menu

Scope: `Header.astro`, `Footer.astro`, `src/lib/mainMenu.ts`, locales, 4 minimal-header templates, `tests/main-menu.test.ts`. Self-review by the executing agent (no fresh-context reviewer); validation: `npm run check` ✅, `npm test` 60/60 ✅, built HTML inspected (home es/en/fr: 4 nav items and pass CTA; Palenque: `data-fixed="join"`; checkout: no nav, no cart).

## Findings
1. (low, open) FR child label `nav.about` "À Propos" repeats the parent "À propos" in the Nosotros dropdown; EN "About Us" under "About". Copy decision for Julio at Level 5.
2. (low, accepted) Static pages ship the in-season CTA ("Comprar pase"); after 2027-01-15 it shows until the page-load script swaps it to "Únete" (one frame). Window end is covered by `isPassSeason` tests.
3. (low, pre-existing) The `scroll` listener in the Header script is added on every `astro:page-load` and never removed; untouched here.
4. (checked, ok) Cart listener: unsubscribed in `astro:before-swap`, re-added on page-load; the drawer stays mounted (only the icon is hidden), so `openCart()` still works with an empty icon.
5. (checked, ok) `festival.css`, event/programación templates and price libs untouched; D20 (PR #18) does not touch the four edited templates.

No blocking issues.
