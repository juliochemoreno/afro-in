# Execution report — D21 Lighter main menu

## Meta Information

- **Plan:** `d21-lighter-menu`, archived at `.agents/plans/done/d21-lighter-menu.md` with every box ticked or waived with a reason.
- **Branch / PR:** `claude/d21-lighter-menu-c0b95c` → `dev`, juliochemoreno/afro-in#19. Commits: `82fe7c4` (plan), `4ca4c23` (menu), `205aee4` (label). Merged by the orchestrator as `73c61cf` after Julio's Level 5 OK. **Not in production yet**: ships with the next `dev` → `main` release.
- **Files added:** `src/lib/mainMenu.ts`, `tests/main-menu.test.ts`, `.agents/code-reviews/d21-lighter-menu.md`.
- **Files modified:** `src/components/Header.astro`, `src/components/Footer.astro`, `src/i18n/locales/{es,en,fr}.json` (`nav.us`, `nav.buyPass`), `src/templates/{Checkout,Pedido,Gracias,Unirse}Template.astro`.

## Validation Results

- Syntax & Linting: not applicable (no linter); `npm run check` ✓ (astro build, tsc, wrangler dry-run).
- Unit Tests: ✓ 60 passed (62 on the merge with D20, run by the orchestrator).
- Integration: built HTML of home es/en/fr, Palenque and checkout inspected; no curl matrix. Level 5 by Julio on the Preview: "D21 ok".

## Code Review Findings

- **File:** `.agents/code-reviews/d21-lighter-menu.md` (self-review, no fresh-context reviewer). 0 blocking; 3 low (FR/EN dropdown child repeats the parent label, one-frame CTA flash after 2027-01-15, pre-existing scroll listener leak).

## Decisions (Julio)

- Menu: first item → `/programacion` with no submenu · Eventos · Tienda · Nosotros ▾ (Sobre nosotros, Galería, Aliados); Contacto and Aliados in the footer; one menu on the whole site; minimal header on checkout/pedido/gracias/unirse.
- Cart icon only with items. CTA "Comprar pase" 2026-11-01..2027-01-15 (Colombia), "Únete" otherwise and on Palenque pages (no pass there). Date-only, no D1 (the optional `/api/tickets/stages` follow-up was declined).
- **Late change at Level 5:** the first item is labelled "AFRO IN Tour" (as before) instead of "Festival 2027", still without a submenu (`205aee4`; `nav.festival` was removed, `nav.tour` reused).

## What Went Well

- One shared `buildMainMenu` feeds Header and Footer; the Header ignores the per-template `navLinks`, so no D20 file was touched and no conflict arose.
- Decisions were taken one at a time with Julio before any code.

## Challenges Encountered

- My own question text said "15 nov" for the season start (it is 1 nov); the plan used the right date.
- Season end was first assumed 2027-01-17; the orchestrator corrected it to 2027-01-15 (pass event date, site hides past events).

## Divergences from Plan

- Label "Festival 2027" → "AFRO IN Tour" (late decision above); `nav.festival` key never shipped.
- No `.agents/hopla-active-plan.json` written (not git-ignored).

## Follow-ups

- Remove the ignored `navLinks`/`ctaLink` props from the remaining templates (D20 is merged, so this is now possible).
- Copy nit: FR/EN dropdown child repeats the parent label.
- Work list: D21 item still needs ticking (not done here).
