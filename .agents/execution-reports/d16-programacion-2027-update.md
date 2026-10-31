# Execution Report: D16 — 2027 programming update (grew into the 2027 pages redesign)

## Meta Information

- **Plan:** `d16-programacion-2027-update` — `.agents/plans/done/d16-programacion-2027-update.md` (archived)
- **Files added:** `src/components/{DayCalendar,EditionPartners,EditionStops,EditionVenue,Flag,Pin,StopLinkCard}.astro`, `src/lib/{activitySignup,flags}.ts`, `src/content/artists2027/afroneto.md`, ~60 photos under `src/assets/img/2027/` (artist web portraits `-web-v/-web-h`, venues, partner logos), `.agents/code-reviews/d16-*.md`, `.agents/plans/d16-gemini-prompts.md`
- **Files modified:** `src/templates/{Edition2027IndexTemplate,Edition2027StopTemplate,Artists2027Template}.astro`, `src/components/{EditionHeadliner,EditionActivities,EditionCountries,EditionDayHead,EditionJourney,EditionTickets,FestivalScrolly,Events}.astro`, `src/styles/festival.css`, `src/lib/{programacion,artistPhotos}.ts`, `src/content.config.ts`, `src/content/tour2027/*` (6 files), `src/content/artists2027/*` (photos, order), `src/i18n/locales/{es,en,fr}.json`, `tests/programacion.test.ts`
- **Lines changed:** +3210 −923 (88 files, merge `c479db4` vs its dev parent)

## Validation Results

- Syntax & Linting: ✓ (`npm run check` = astro build + tsc + wrangler dry-run, exit 0, run on its own after the last fix)
- Type Checking: ✓ (part of `npm run check`)
- Unit Tests: ✓ 32 passed, 0 failed (`npm test`)
- Integration Tests: ✓ Preview (Workers Builds, `75fde8b`): 14 pages 200 in es/en/fr, 2026 redirects 301, `x-robots-tag: noindex`, ~300 image URLs 200. Julio checked the Preview ("todo ok") before the merge.

## Code Review Findings

- **Code review file:** `.agents/code-reviews/d16-programacion-2027-update-final.md` (whole branch vs `origin/dev`, fresh-context agent, high effort); earlier one: `.agents/code-reviews/d16-programacion-2027-update.md`
- **Issues found:** 0 critical, 0 high, 1 medium, 2 low (6 more dropped at confidence 40–60)
- **Issues fixed before this report:** 3 of 3
- **Key findings:** price-stage script ran once per full page load but the layout uses ClientRouter, so after in-site navigation the current tier and buy button stayed hidden; two artists shared `order: 6`; flags had `role="img"` next to the printed country name (read twice).

## What Went Well

- One layout rule (container = site header, `--fz-bleed`, one section padding, mask fades) held across the home, `/programacion`, the stop pages and `/artistas`; later changes were mostly one-line token edits.
- Measuring with JS (left edges vs the logo, heights per width, panel positions) caught problems screenshots could not show, because the browser pane was hidden.
- Extracting `EditionHeadliner` options (`reverse`, `center`, `star`, `portrait`) let `/artistas` reuse Robe's block for every artist instead of a second design.
- Country made optional with graceful fallbacks, so an artist without a known country (Afroneto before confirmation) needed no special case.
- No ticketing, checkout or payment code was touched.

## Challenges Encountered

- The in-app browser pane was hidden: scroll events, IntersectionObserver and transitions did not run on their own, lazy images often did not paint, and `decode()` hung; checks relied on dispatched scroll events and numeric measurements.
- Julio's decisions arrived through the orchestrator as a long chain of corrections that superseded each other (overlays → masks, container widths, bleed sides, stacking panels, home style); each had to be re-applied against the latest instruction.
- Sticky/stacking/pinned-photo behaviour could only be verified by geometry, not by feel (snap was tried and removed by Julio).

## Bugs Encountered

| Bug | Category | Found By | Severity |
|-----|----------|----------|----------|
| `--fz-bleed` used `100vw` (includes the scrollbar): card text 7px right of the header logo | styling | manual testing (JS measure) | medium |
| Robe's name wrapped to two lines at 1920px once the container narrowed | styling | manual testing | low |
| Territory card text clipped on the right card (name wider than its box) | styling | manual testing | medium |
| Tier stages/buy button hidden after client-side navigation (ClientRouter) | other (lifecycle) | code review | medium |
| Two artists with the same `order` | other | code review | low |
| Flags announced twice by screen readers | other (a11y) | code review | low |
| Transient `ImageMissingAlt` overlay on the home while `Events.astro` was half-written (a shell step hung on `cat` with no stdin, so the rewrite did not run) | other (process) | manual testing | low |

## Divergences from Plan

**Scope grew from a content update to the redesign of the 2027 pages**

- **Planned:** new activities per day, a presale block with two buttons, bigger Palenque title, photos, es/en/fr.
- **Actual:** also the full layout system (header-aligned container, edge-to-edge and half-screen photos with mask fades, one rhythm), photo hero, journey with sticky photo, `/artistas` redesign (alternating blocks, stacking panels, pinned photo on phones), Afroneto, 3×3 guest grid, and the home section replaced by the 2027 stops.
- **Reason:** Julio's iterative decisions during execution (through the orchestrator).
- **Type:** Other

**Presale config named `SALES` with `tickets` and `afroBatalla` instead of `PRESALE_LINKS`**

- **Planned:** one `PRESALE_LINKS = { presale, afroBatalla }`.
- **Actual:** `SALES = { tickets: { url }, afroBatalla: { price, url } }` in `src/lib/programacion.ts`; still one place to set both links.
- **Reason:** Julio's follow-up (presale button on the current tier, price carried with the config).
- **Type:** Better approach found

**Home page section changed**

- **Planned:** not in the plan.
- **Actual:** the "AFRO IN Tour 2026" section of the home (`Events.astro`) now shows the 2027 stops in the home's own style.
- **Reason:** item D15 folded into this branch by Julio.
- **Type:** Other

## Scope Assessment

- **Planned tasks:** 5 (+ test task)
- **Executed tasks:** 5 + test task, plus the redesign work
- **Unplanned additions:** ~10 items (layout system, hero, journey, `/artistas` redesign, Afroneto, guest grid, home section, flags, calendar, partners)
- **Scope accuracy:** Under-scoped (took far more work than planned; the plan's own estimate was 2 UX iterations)

## Skipped Items

- Gemini edits of the El Morro and Palenque photos — Reason: Julio decided per photo; the originals are used.
- DJ Joe final photo, arroyo date (17 vs 18), time of the Fri 15 event, presale/Afro Batalla event links — Reason: waiting on Julio/team content (listed in the PR).

## Technical Patterns Discovered

- **Pattern/Gotcha:** a layout token that depends on the viewport width must use the container width (`100cqw` with `container-type: inline-size` on the page root), not `100vw`, or it is off by the scrollbar width on desktop.
- **Where it applies:** any full-bleed photo or text aligned to a centered max-width container.
- **Ready-to-paste AGENTS.md / CLAUDE.md entry:** `- Full-bleed layouts (photos that bleed past the content column): derive the distance to the screen edge from the container (\`100cqw\`, with \`container-type: inline-size\` on the page root), never from \`100vw\` — \`100vw\` includes the scrollbar and misaligns text by its width.`

- **Pattern/Gotcha:** inline `<script>` in a component that mutates DOM runs once per full load; the layout uses `ClientRouter`, so it must run on `astro:page-load`.
- **Where it applies:** any Astro component script that reads or changes the page DOM.
- **Ready-to-paste AGENTS.md / CLAUDE.md entry:** `- Component \`<script>\` blocks that touch the DOM must be wrapped in a function registered with \`document.addEventListener("astro:page-load", fn)\` (the layout uses \`<ClientRouter />\`); a bare top-level script only runs on the first full page load.`

- **Pattern/Gotcha:** a shell command that starts with `cat > file` and no input waits on stdin and hangs the step.
- **Where it applies:** agent shell scripts.
- **Ready-to-paste AGENTS.md / CLAUDE.md entry:** Not applicable (tooling habit: use the Write tool, never a bare `cat >`).

## Recommendations

- Plan command improvements: when a request is "update content" but the user is iterating on the look, say early that the scope is a redesign and plan the shared layout tokens first.
- Execute command improvements: keep visual measurements (left edges, heights per width) in the validation level; screenshots alone are unreliable when the preview pane is hidden.
- AGENTS.md / CLAUDE.md additions: the two entries above.
