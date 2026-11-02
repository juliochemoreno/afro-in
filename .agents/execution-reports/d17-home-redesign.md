# Execution Report: D17 — Home redesign in the 2027 style

## Meta Information

- **Plan:** `d17-home-redesign` — `.agents/plans/done/d17-home-redesign.md`
- **Commit:** 25a0bce on `claude/d17-home-redesign-661a3c`, merged into `dev` as ef0263e (`--no-ff`, no PR: Julio asked for a direct merge)
- **Files added:** `.agents/plans/d17-home-redesign.md`, `.agents/code-reviews/d17-home-redesign.md`
- **Files modified:** `src/templates/HomeTemplate.astro`, `src/templates/UnirseTemplate.astro`, `src/components/{Hero,About,Documentary,Gallery,Events,Store,FeaturedProducts,Registration,Allies,Community,Contact}.astro`, `src/i18n/locales/{es,en,fr}.json`, `src/styles/festival.css`
- **Lines changed:** +1607 −2425 (19 files, including the plan and the review, 215 lines)
- **Production:** not released yet (goes out with a daily release). No migrations.

## Validation Results

- **Syntax & Linting:** not applicable. The repo has no lint script.
- **Type Checking:** ✓ `npx tsc --noEmit` and ✓ `npm run check` (astro build, tsc, wrangler dry-run), run again after the last change before the commit.
- **Unit Tests:** ✓ `npm test` 120 passed, 0 failed (no new tests: visual and copy work).
- **Integration Tests:** ✓ local `astro dev` (port 4391): `/`, `/en`, `/fr`, `/unirse`, `/en/join`, `/fr/rejoindre`, `/tienda`, `/aliados`, `/programacion` return 200. Store section and `/api/contador` checked with real local data (the worktree's empty local D1 was replaced by a copy of the main checkout's local D1).
- **Human (Level 5):** ✓ Julio reviewed the home locally in his browser through several rounds and approved it ("Se ve bien", "Están bien", then "commit, merge directo").

## Code Review Findings

- **Code review file:** `.agents/code-reviews/d17-home-redesign.md` (native high-effort review plus HOPLA checklist, then a second pass over the later changes)
- **Issues found:** 0 critical, 1 high, 2 medium, 1 low kept; 3 dropped (low confidence)
- **Issues fixed before this report:** 3
  - Contact form ids collided with the donation form (`#name`): the WhatsApp message lost the visitor's name. Pre-existing; fixed with `contact-name` / `contact-message`.
  - Home product cards had dropped the CMS badge; restored.
  - The hero counter was formatted es-CO on the server and with the page language in the browser; one locale from `lang` now.
- **Skipped:** the hero animates to the hard-coded default 12.847 when `/api/contador` fails (pre-existing; follow-up).

## What Went Well

- Visual previews in the browser pane before any code let Julio steer the direction quickly; the final structure (today's ten sections and order, restyled) came from his comparisons, not from a plan written up front.
- Reusing the 2027 pieces kept the new CSS small: `.fz-headliner` for the hero, `EditionTickets` for the Santa Marta pass block, `src/lib/allies.ts` logos, `festival.css` tokens plus a short `hm-*` block.
- The donation and contact scripts were left untouched except for the contact field ids; the payment flow (Bold, PayPal, `/api/*`) did not change.

## Challenges Encountered

- Direction changed several times during design: naming (Afro Acción), three concept directions rejected as too flat, then "too far from today's home", then the hero modelled on the Robe L Ninho block, light/dark vs all dark. Each was settled with a preview before coding.
- The local dev server in the worktree had an empty D1, so the store server island crashed with `no such table: products` and Julio saw the error overlay; fixed by copying the main checkout's local D1 into the worktree.
- React comboboxes portal their dropdown to `<body>`, out of the page's scoped styles: the dark dropdown needed `:root:has(main.fz.home)` selectors in `festival.css`.

## Divergences from Plan

- **Store cards:** the plan said cards like the `/programacion` artist cards. Julio rejected them after seeing them (white product photos under dark scrims), and the cards now follow the old home card layout in the dark style (photo on a white panel, badge, name, prices, button).
- **Section order:** the store moved under AFRO IN 2027 (Julio); section tones swapped to keep the alternation.
- **AFRO IN 2027:** card buttons say "Ver programación"; the bottom program/presale buttons were replaced by the Santa Marta pass block (`EditionTickets`), sticky buy bar included (Julio chose to keep it). Stop highlights rewritten as five general lines per stop from the 2027 programme, with Robe L Ninho on his own line (Julio). `events.presale`, `events.stopLink`, `store.home.view`, `allies.cta.*`, `hero.cards.*`, `hero.counter.label`, `join.counter` keys removed as unused.
- **Inputs and dropdowns:** icons on the text inputs and dark dropdowns/scrollbars were added on Julio's request during review (not in the plan).
- **Documentary:** the play button's pulse animation restored (square) after Julio noticed it was gone.
- **Shared CSS:** a `hm-*` home block was added to `festival.css` (the plan only named per-component styles) to avoid repeating section heads, lists, cards and buttons in every component.
- **Gallery:** `data-category` added to gallery items (filters stay hidden; recorded in the review).
- **Git:** one commit instead of intermediate commits (Julio was iterating locally and asked to wait), merged directly into `dev` without a PR (Julio).

## Skipped Items

- Hero fallback when `/api/contador` fails (shows the hard-coded 12.847): pre-existing, outside the plan; listed as a follow-up.

## Recommendations

- **Plan-feature:** for visual work, agree the structure on a full-page preview first, then write the plan; the first two plans here were written before the look was settled and were rewritten.
- **Execute:** start the worktree's dev server with the main checkout's local D1 (or apply local migrations) before showing pages that read D1, so server islands do not crash in front of the reviewer.
- **CLAUDE.md / project notes:** record that portaled React dropdowns need page-level (`:has()`) styling on dark pages, and that dark form field styles now live in three places (home donation, home contact, event checkout) and should be unified.

## Follow-ups

- Hero: hide the number (or show "—") when `/api/contador` fails instead of the hard-coded 12.847.
- `/gracias` and its wording in the Afro Acción voice.
- Dark form field styles duplicated in `Registration.astro`, `Contact.astro` and `EventoSlugTemplate.astro`: unify in `festival.css`.
