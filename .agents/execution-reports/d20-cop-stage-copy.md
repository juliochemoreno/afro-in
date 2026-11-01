# Execution report — D20 COP always visible, stage 1 copy, real-stage tier

## Meta Information

- **Plan:** `d20-cop-stage-copy`, archived at `.agents/plans/done/d20-cop-stage-copy.md` with every box ticked or waived with a reason.
- **Branch / PR:** `claude/d20-cop-stage-copy-461ba8` → `dev`, juliochemoreno/afro-in#18. Commits: `8d0bc6d` (COP + copy), `96582bc` (endpoint + client script), `4e58b02` (review fixes). Merged by the orchestrator as `9940816` after Julio's Level 5 OK. **Not in production yet**: ships with the next `dev` → `main` release.
- **Files added:** `src/lib/money.ts`, `src/pages/api/tickets/stages.ts`, `.agents/code-reviews/d20-cop-stage-copy.md`, `.agents/plans/done/d20-cop-stage-copy.md`.
- **Files modified:** `src/lib/programacion.ts`, `src/lib/cart.ts`, `src/lib/products.ts`, `src/lib/activitySignup.ts`, `src/lib/ticketStages.ts`, `src/components/EditionTickets.astro`, `src/components/TicketCheckoutForm.tsx`, `src/templates/EventoSlugTemplate.astro`, `src/templates/EventosIndexTemplate.astro`, `src/styles/festival.css`, `src/content/tour2027/santa-marta{,.en,.fr}.md`, `tests/programacion.test.ts`, `tests/ticket-stages.test.ts`.
- **Lines changed:** +385 −58 across 19 files (`380eed1..4e58b02`).

## Validation Results

- Syntax & Linting: ✓ `npm run check` (astro build, tsc, wrangler dry-run) after the last fix.
- Type Checking: ✓ included in `npm run check`.
- Unit Tests: ✓ 59 passed, 0 failed (also re-run by the orchestrator on the merge).
- Integration Tests: Not applicable (none in the project). Level 5 done by Julio on the branch Preview: "D20 ok".

## Code Review Findings

- **Code review file:** `.agents/code-reviews/d20-cop-stage-copy.md`
- **Issues found:** 0 critical, 1 high, 1 medium, 0 low (3 more dropped at low confidence).
- **Issues fixed before this report:** 2.
- **Key findings:** a pass with no stages was reported as `ended` (would hide every tier) and event-level `soldOut` was ignored. Both fixed in `4e58b02`.

## What Went Well

- Option A (public endpoint + client script) kept the pages static; the date decides first and the real stages only refine it, so any failure leaves today's behavior.
- One shared formatter (`formatCopAmount`) replaced five divergent price formatters and the hand-written COP spans.
- Pure `tierStagesFromSale` and `publicSale` made the logic unit-testable without D1.

## Challenges Encountered

- Julio's format answers conflicted when relayed (small suffix vs "$20.000 COP" in running text); asking Julio directly settled it: same size, attached ("Pegado en todo").
- Matching tiers to real stages has no shared id: tiers are matched by price, with the date as fallback on any mismatch.

## Bugs Encountered

| Bug | Category | Found By | Severity |
|-----|----------|----------|----------|
| Stageless pass answered `ended` | scope mismatch | code review | high |
| Event-level `soldOut` ignored | other | code review | medium |

## Divergences from Plan

**Stageless pass answers 404**

- **Planned:** `publicSale(null)` → `{state:"ended"}`.
- **Actual:** the endpoint answers 404 (cached 60 s) for a pass without stages; `ended` only when `event.soldOut`.
- **Reason:** `ended` would hide all tiers for an event that merely lacks stages.
- **Type:** Plan assumption wrong

## Scope Assessment

- **Planned tasks:** 8
- **Executed tasks:** 8
- **Unplanned additions:** 1 — removal of the orphan `.tix-cur`, `.ev-cur`, `.fz-tier-cur` CSS rules left by the removed COP spans.
- **Scope accuracy:** On target

## Skipped Items

- "Stage 1 sold out ⇒ tier 2 shown" in a browser — Reason: needs production data; covered by unit tests only.
- Level 4 `curl` twice on the Preview — Reason: the pass exists only in production, so the Preview endpoint answers 404 (date-based fallback). Payload keys are locked by a `deepEqual` test.
- The Workers Cache API layer (`caches.default`) is best effort and unobserved on this adapter; the 60 s `Cache-Control` header is the guaranteed part. Worth one `curl -i` twice on production after the release.

## Technical Patterns Discovered

- **Pattern/Gotcha:** public prices must go through `formatCopAmount` (`src/lib/money.ts`), never a local `Intl.NumberFormat` plus a literal "COP".
- **Where it applies:** any new price display (store, tickets, programming pages).
- **Ready-to-paste AGENTS.md / CLAUDE.md entry:** `- Public prices: always format with formatCopAmount(amount, locale) from src/lib/money.ts ("$20.000 COP", non-breaking space). Never add a separate COP span or suffix.`

## Recommendations

- Plan command improvements: when a plan's Level 4/5 depends on production-only data, say so in the validation checklist up front (this plan did).
- Execute command improvements: none.
- AGENTS.md / CLAUDE.md additions: the entry above.
