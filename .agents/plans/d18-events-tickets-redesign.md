# Plan: D18 — Events list, event page and tickets pages in the 2027 style

## Overview
Restyle the public ticketing pages — the events list (`/eventos`), the event page with its checkout form, and "Tus entradas" (`/entradas`, the ticket stub with QR) — to the dark editorial look of the 2027 programming pages (D16). Visual and markup only: pricing, the checkout API, Bold, order/ticket logic and the database do not change.

## Requirements Summary
- es/en/fr, desktop and mobile, on every page below.
- **Events list — option B (Julio, 2026-10-31):** 3-column grid (2 below 1024px, 1 below 640px) of photo cards with no box: vertical 4:5 photo, gold calendar block (weekday/day/month) on the photo's top-left, a status flag top-right, event name in Anton, venue with the MapPin icon, and a bottom row with the stage name and the price in COP (struck through when sold out). Upcoming events only (Julio: no "past" section).
- **Event page — option A "DICE poster" (Julio):** poster photo on the left (sticky on desktop), on the right: kicker, title, gold calendar block with the full date and time, venue with pin, the staged prices list (current stage highlighted, past stages struck through, upcoming muted, COP), then the buy box (gold double frame) with `TicketCheckoutForm` restyled dark, then the description. One column on mobile (photo, facts, prices, buy box, description).
- **Checkout form:** dark fields with clear uppercase labels and visible inline errors; ALL behavior stays (validation, focus on first invalid field, Bold handoff, `price_changed` 409 flow, holds, free events, sold out).
- **Tus entradas — option A "cream paper ticket" (Julio):** dark page; success header with a gold check ring; order line; each ticket is a stub with a dark header band (brand, "Entrada n / N", name, calendar block, date · venue), a perforation with notches, and a cream body with the QR on a pure white square plus the code. Pending/failed states restyled dark. A "Print tickets" button; printing gives white paper, black text, every ticket stacked, no header/footer/buttons.
- Shared look: `festival.css` tokens (`.fz`, `.fz-wrap`, `.fz-display`, `.fz-cal`, `.fz-frame`), `FestivalFont`, `Pin.astro`, `Header variant="festival"`.
- References Julio asked for (researched 2026-10-31): DICE event page (poster left, price + buy right under the facts, before the description); RA list (poster, accent date, title, venue with pin); vendor guidance: mark the current tier, keep sold-out/past tiers visible and clearly labelled, tiers readable on a phone.

## Out of Scope
- Past events (a new query): Julio chose upcoming only.
- Any change to `src/lib/tickets.ts`, `src/lib/ticketStages.ts`, `src/lib/bold.ts`, `src/pages/api/**`, migrations, the admin pages, the check-in scanner, the QR content (still the plain ticket code).
- `src/lib/programacion.ts` and `src/components/EditionTickets.astro` (D13 phase 4 may edit them).
- The country/dial-code popover of `PhoneField` (portaled to `<body>`, shared with the store and donation forms): stays light.
- A sticky mobile "Buy" bar (see Likely Follow-ups).
- Copy rewrites beyond moving hardcoded Spanish strings into i18n.

## Likely Follow-ups
- Sticky mobile bar "price · Buy" that scrolls to the buy box (DICE pattern).
- A "past events" section (needs a read-only query).
- Restyle the store / product / store checkout pages in the same style.
- Email with the tickets (today there is none).

## Git Strategy
- **Base branch:** `dev` (worktree created from `dev` at f1c8d53)
- **Feature branch:** `claude/d18-events-redesign-354feb` (this worktree's branch; one PR to `dev`)

## Context References
- `src/templates/EventosIndexTemplate.astro` (190 lines) — list; data from `getVisibleEvents(db)` (`src/lib/tickets.ts:251`): visible events with `event_date > now`, soonest first; each is a `PublicEvent` (`tickets.ts:75`: `soldOut`, `remaining`, `price` = current/next stage price, `stages`, `sale`).
- `src/templates/EventoSlugTemplate.astro` (485 lines) — event page; `sale.state` `upcoming` shows the "opens on" block instead of the form (`:195`); stage list uses `stageName`, `StageStatus` (`current|soldout|past|upcoming`), `fmtDay` with `timeZone: "UTC"` on noon-UTC dates (`:55`). Holds all the form's global CSS (`.tix-form`, `.tix-qty`, `.tix-stepper`, `.tix-total`, `.tix-pay`, `.ck-error`, `.tix-soldout`).
- `src/components/TicketCheckoutForm.tsx` (315 lines) — ids `tix-name`, `tix-email`, `tix-phone` (+ `-error`) used by the focus logic (`FIELD_IDS`, `:35`); hardcoded Spanish at `:295` ("Entrada Libre (Gratis)"), `:309` ("Reservar entradas gratis"), aria-labels "-"/"+" at `:229`/`:238`. Template hardcodes "Reservar Entradas" at `EventoSlugTemplate.astro:194`.
- `src/styles/checkout-fields.css` — GLOBAL, shared with the store checkout and the donation form: `.ph-field`, `.cc-trigger`, `.ph-number`, `.ck-field-error`, `.is-invalid` (light colors). Dark overrides must be scoped under `.tix-form` so the other forms do not change.
- `src/templates/EntradasTemplate.astro` (≈560 lines incl. global CSS) — token page (server-rendered `TicketList`) vs `TicketReceipt` (confirms via `/api/tickets/confirm`); `noindex`, `Cache-Control: private, no-store` and `Referrer-Policy: no-referrer` set in `src/pages/entradas/[token].astro` (keep).
- `src/components/TicketReceipt.tsx`, `TicketList.tsx` (hardcoded aria "Anterior", "Siguiente", "Entrada n"), `TicketQR.tsx` (hardcoded "ENTRADA"; QR = `qrcode-generator` from jsDelivr with SRI, `createDataURL(6, 6)`).
- `src/styles/festival.css` — `.fz` tokens (`:4`), `.fz-wrap` (`:49`), `.fz-frame` (`:66`), `.fz-cal` (`:836`), `.fz-pin` (`:347`); rule 11 (`container-type: inline-size` on `.fz`).
- `src/components/EditionStops.astro` — the photo card pattern (mask fades, scrims, gold range, Anton name, pin).
- `src/components/Header.astro:26` — `variant="festival"` dark header. `src/components/FestivalFont.astro` loads Anton. `src/components/Pin.astro` (per-icon `lucide-astro/MapPin`).
- `src/layouts/Layout.astro:254` — `.whatsapp-float` (hide when printing).
- `src/i18n/locales/{es,en,fr}.json` — `tix.*` keys (es.json `:306–366`).
- `event_date` is a Bogotá wall-clock string `YYYY-MM-DDTHH:mm` (`migrations/0008_create_ticketing.sql:20`).
- `tests/` + `npm test` = `node --experimental-strip-types --test "tests/**/*.test.ts"` (pattern: `tests/ticket-stages.test.ts`).
- Mockups shown to Julio: scratchpad `mock/events-list.html`, `mock/event-page.html`, `mock/ticket.html` (served on 127.0.0.1:8765 during planning).
- No component on these pages uses an Astro `<script>`; all interactivity is in React islands (rule 10 does not come into play unless a script is added).
- Dependents search: `grep -rln "EventoSlugTemplate\|EventosIndexTemplate\|TicketReceipt\|TicketList\|TicketQR\|tix-form" src` → the 6 route files, `EntradasTemplate.astro` and the components above only (admin uses `TicketOrdersDashboard`, not these).

## Domain Assumptions
- The list card's status flag: "Agotado" when `soldOut`; "Abre el {date}" when `sale.state === "upcoming"`; the current stage name when the event has stages; nothing otherwise. Price row: "Gratis" when price 0, else `formatPrice(price)` + "COP".
- Stage status words keep today's i18n values ("Ahora", "Agotada", "Terminada", "Próximamente"); the brief's "Finalizada" is not used unless Julio wants the copy changed.
- Event-page kicker is "AFRO IN · {city}" (events have no edition field).
- Events with no photo get a dark fallback panel with the gold AFRO IN wordmark (dev events have none).
- The "Print tickets" button is in scope (Julio asked for printable tickets).
- The success subtitle keeps today's text (no "we emailed you", since no email is sent).

## Implementation Tasks

### Task 1: Display helpers for dates and card status (TDD)
- **Action:** create
- **File:** `src/lib/eventDisplay.ts`, `tests/event-display.test.ts`
- **Pattern:** `tests/ticket-stages.test.ts`, `src/lib/ticketStages.ts` (pure functions, no DOM)
- **Details:** `calParts(eventDate: string, lang)` → `{ weekday, day, month }` (short, localized, no tz drift: build `Date.UTC` from the string parts, format with `timeZone: "UTC"`); `eventTime(eventDate, lang)` → localized time; `cardStatus(e: Pick<PublicEvent,"soldOut"|"sale"|"stages"|"price">)` → `{ kind: "soldout" | "opens" | "stage" | "none", stageName?, opensOn? }`. Tests first: es/en/fr month/weekday for `2027-01-15T20:00`, midnight edge `2027-01-15T00:30` stays on the 15th, each `cardStatus` branch.
- **Gotcha:** `new Date("2027-01-15T20:00")` is local time; never rely on the runtime tz.
- **Validate:** `node --experimental-strip-types --test tests/event-display.test.ts`

### Task 2: i18n keys for the new copy and the hardcoded strings
- **Action:** modify
- **File:** `src/i18n/locales/es.json`, `en.json`, `fr.json`
- **Pattern:** existing `tix.*` keys
- **Details:** add `tix.list.kicker`, `tix.list.empty.cta` (link to the programming), `tix.list.opens` ("Abre el {date}"), `tix.detail.about`, `tix.detail.reserve` (free-event heading), `tix.form.total.free`, `tix.form.reserve`, `tix.form.qty.less`, `tix.form.qty.more`, `tix.receipt.print`, `tix.receipt.prev`, `tix.receipt.next`, `tix.receipt.ticketn` ("Entrada {n}"), `tix.ticket.kind`, `tix.ticket.of` ("Entrada {n} / {total}"). Same keys in the 3 files.
- **Gotcha:** D13 may also touch the locale files; keep additions grouped next to the existing `tix.*` block to make conflicts trivial.
- **Validate:** `node -e` script that loads the 3 JSON files and prints keys missing in any of them (expect none).

### Task 3: Events list in the 2027 style (option B)
- **Action:** modify
- **File:** `src/templates/EventosIndexTemplate.astro`
- **Pattern:** `src/components/EditionStops.astro`, `src/templates/Artists2027Template.astro` (`.fz` page, `FestivalFont`, `Header variant="festival"`)
- **Details:** `<main class="fz events">` + `.fz-wrap`; heading (gold kicker, Anton h1 `tix.list.title`, lead `tix.list.subtitle`); grid 3/2/1 columns (breakpoints 1024/640); card = `<a>` with photo 4:5 (`<img loading="lazy">` from `/media/…`, or fallback panel), `.fz-cal` overlay (from `calParts`), flag (from `cardStatus`), Anton name, venue line with `<Pin />`, bottom row stage name + price COP (sold out: muted, struck). Hover: photo scale 1.03 + arrow; focus-visible gold outline; `prefers-reduced-motion` respected. Empty state: text + link to `getTranslatedPath("/programacion", lang)`. Keep `navLinks`.
- **Gotcha:** this page is SSR: keep plain `<img src="/media/...">` (no `astro:assets`, rule 4). Don't use `100vw` (rule 11).
- **Validate:** `curl -s localhost:4321/eventos | grep -c 'class="ev-card'` equals the event count; same for `/en/events`, `/fr/evenements`.

### Task 4: Event page layout (option A)
- **Action:** modify
- **File:** `src/templates/EventoSlugTemplate.astro`
- **Pattern:** mockup `event-page.html` option A; `.fz-frame` from `EditionTickets.astro`
- **Details:** `.fz` page, `FestivalFont`, festival header; grid `5fr 6fr` (one column below 900px), poster sticky `top: 100px` on desktop (4:5, fallback panel), right column: back link, kicker, Anton h1, facts (`.fz-cal` + long date + time; `<Pin heavy/>` + venue / city · department), remaining note, `h2` + stages list (keep `stage-${status}` classes; current: gold left bar + red "Ahora" flag; past/soldout: struck price, 45% opacity; upcoming: cream price), buy box `.fz-frame` > `.fz-frame-inner` with heading (`tix.detail.buy` / `tix.detail.reserve`) and the form or the "opens" block, then `h2 tix.detail.about` + description. Replace the light global CSS of `.evento-*` and `.tix-*` with dark rules scoped under `.evento-page`.
- **Gotcha:** keep `client:load`, every prop and the `strings` keys passed to the form (add the new ones from Task 2). The template's `fmtDate` stays for the long date.
- **Validate:** curl `/eventos/dev-evento-por-etapas` in es/en/fr: 200, contains `stage-current`, `tix-name` after hydration markup (`astro-island`), no "Reservar" in en/fr HTML.

### Task 5: Checkout form dark restyle + hardcoded strings
- **Action:** modify
- **File:** `src/components/TicketCheckoutForm.tsx`, CSS in `src/templates/EventoSlugTemplate.astro`
- **Pattern:** current component; `checkout-fields.css` selectors (override, scoped)
- **Details:** JSX: only swap hardcoded strings for `t[...]` keys (free total, free button, stepper aria-labels) and wrap the total amount with a small "COP" span. No change to state, validation, fetch body, Bold config, `price_changed`, ids. CSS (scoped `.evento-page .tix-form …`): uppercase muted labels, 48px dark fields `rgba(243,233,210,.04)` with `rgba(243,233,210,.25)` border, gold focus ring, error state red border + `#ff8a8a` text (≥4.5:1 on #161616), `.ph-field` / `.ph-dial` dark, stepper outline gold, total Anton gold, pay button red full width, secure note muted, `.ck-error` banner with red left bar.
- **Gotcha:** `checkout-fields.css` is global and later-loaded rules may win: use selectors at least as specific as `.tix-form .ck-field .ph-field input.ph-number` and `.ck-field.is-invalid input:not(...)`. Do not edit `checkout-fields.css` (store/donation).
- **Validate:** in `astro dev`, empty submit shows 3 inline errors and focuses `#tix-name`; store `/checkout` and donation form look unchanged (screenshot before/after).

### Task 6: Ticket stub (cream paper) and ticket list
- **Action:** modify
- **File:** `src/components/TicketQR.tsx`, `src/components/TicketList.tsx`
- **Pattern:** mockup `ticket.html` option A
- **Details:** `TicketQR`: new optional props `eventDate?: string | null`, `kindLabel`, `lang`; header band `#1f1f1f` with gold brand row ("AFRO IN" + `tix.ticket.of`), Anton name, `.fz-cal`-like block from `calParts` + subtitle; perforation with notches matching the page background; cream body; QR `<img>` inside a pure `#fff` box with 14px padding (quiet zone), `image-rendering: pixelated`, keep `createDataURL(6, 6)` and SRI; "used" stamp kept. `TicketList`: pass `eventDate`, i18n aria-labels, order line restyled, slider arrows/dots in gold, save-link block dark, new "Print" button (`window.print()`).
- **Gotcha:** keep the QR payload = `code` and its error-correction level `M`. The notches use the stage background color: define it once as a CSS variable.
- **Validate:** decode a rendered QR (screenshot → `zbarimg` if installed, else phone camera) = the code; Level 5 scan with `/admin/checkin`.

### Task 7: Tus entradas page + receipt states + print
- **Action:** modify
- **File:** `src/templates/EntradasTemplate.astro`, `src/components/TicketReceipt.tsx`
- **Pattern:** `.fz` pages
- **Details:** `.fz` main, festival header, `FestivalFont`; success head (gold check ring, Anton title, muted text); pending/failed card dark with gold/red ring icons; spinner gold; pass `eventDate` (token page: `tokenOrder.event.event_date`; receipt: `event.event_date`) and new strings. `@media print`: white background, black text, hide `header`, `footer`, `.whatsapp-float`, buttons, save-link, slider arrows/dots; slider track becomes a vertical stack; each `.tix-stub` `break-inside: avoid`, stub header band printed with a 1px black border instead of a dark fill (no ink-heavy fills; QR stays black on white).
- **Gotcha:** `TicketReceipt` is `client:only` on `/entradas` and `client:load` on the token page: no `window` access during render (the print button handler only).
- **Validate:** Chrome print preview of `/entradas/<token>` with 2 tickets: both stubs on paper, no dark backgrounds.

## Interaction Matrix

| Action | Context | Expected Behavior |
|--------|---------|-------------------|
| Click / Enter on a list card | any event | opens the event page |
| Tab through list | cards | gold focus outline on each card |
| − / + | qty 1 / qty max (min(10, remaining)) | − disabled at 1, + disabled at max (unchanged) |
| Pay with empty fields | form | 3 inline errors, focus + scroll to the name field (unchanged) |
| Edit a field after a failed submit | form | its error clears/updates live (unchanged) |
| Pay, server 409 `price_changed` | form | new price shown, message banner, total recomputed (unchanged) |
| Pay, free event | form | button "reserve" text (i18n), redirect to `/entradas/<token>` (unchanged) |
| Sale not open | event page | "opens on {date}" block instead of the form |
| Sold out | list / event page | flag "Agotado", struck price / sold-out block |
| Slider ← → / dots | 2+ tickets | scroll between stubs (unchanged), arrows hidden on mobile |
| Print | Tus entradas | all tickets stacked on white paper |

## Test Tasks
- Task 1 creates `tests/event-display.test.ts` (dates in 3 languages, tz edge, status branches).
- Manual (UI, not unit-testable here): Interaction Matrix rows in `astro dev`; regression of the store `/checkout` and the donation form (they share `checkout-fields.css`).

## Phase Boundaries
1. Tasks 1–3 → commit `feat(events): 2027-style events list` (includes `tests/event-display.test.ts`, GREEN).
2. Tasks 4–5 → commit `feat(events): 2027-style event page and checkout form`.
3. Tasks 6–7 → commit `feat(tickets): 2027-style tickets page, stub and print`.
Then fresh-context `/hopla:code-review`, fixes in their own commit, PR.

## Validation Checklist
- [ ] **Level 1 — Lint & Format:** none configured in this repo (orchestrator: no lint).
- [ ] **Level 2 — Type Check / build:** `npm run check` (astro build + tsc + wrangler dry-run), on its own.
- [ ] **Level 2.5 — Code Review:** `/hopla:code-review` in a fresh context on the branch diff, before the PR.
- [ ] **Level 3 — Unit Tests:** `npm test`, on its own.
- [ ] **Level 4 — Integration:** `astro dev` with a local D1 (migrations + `seeds/local.sql` + the 3 `[DEV]` events and stages from `seeds/preview.sql`, `--local --env local`) and a temporary `.dev.vars` with fake keys (deleted afterwards): curl 200 + key markers for `/eventos`, `/en/events`, `/fr/evenements`, the 3 event slugs × 3 languages, `/entradas`, `/en/tickets`, `/fr/billets`; screenshots desktop 1280 and mobile 375 of list, event page (with an error state) and a token tickets page.
- [ ] **Level 5 — Human Review (before merge, on the branch Preview):** (1) Julio makes a TEST purchase in Bold test mode on `dev-evento-por-etapas` (he types the card data) — if skipped, the restyled form ships without a real Bold handoff check; (2) the resulting QR is scanned with `/admin/checkin` (iPhone) — if skipped, scannability of the new stub ships unverified; (3) Julio looks at the 3 pages on his phone and desktop — design sign-off; (4) print preview of the tickets page.

## Acceptance Criteria
- [ ] The 3 page families render in the dark 2027 style in es/en/fr, desktop and mobile, matching options B / A / A.
- [ ] No Spanish text in the en/fr versions of these pages (hardcoded strings moved to i18n).
- [ ] Checkout behavior unchanged: validation + focus, `price_changed`, free events, sold out, not-open, Bold opens with prefilled data.
- [ ] A ticket bought on the Preview scans OK at `/admin/checkin`.
- [ ] The tickets page prints all tickets legibly on white.
- [ ] The store checkout and donation form look exactly as before.
- [ ] `npm run check` and `npm test` pass.

## Confidence Score: 8/10
- **Strengths:** design decided by Julio with mockups; patterns and tokens exist (D16); scope is CSS/markup with one pure helper.
- **Uncertainties:** CSS specificity fights with the global `checkout-fields.css`; real event photos may be landscape (4:5 crop); local D1 setup for curl.
- **Mitigations:** scoped high-specificity selectors + before/after screenshots of store/donation forms; `object-fit: cover` with centered position; seed only the `[DEV]` events locally.

## Notes for Executing Agent
- Visual only. If a change seems to need `src/lib/tickets.ts`, an API route or the DB, stop and ask.
- Don't touch `src/lib/programacion.ts` or `src/components/EditionTickets.astro` (D13).
- Restart `astro dev` with `--force` if islands stop hydrating ("504 Outdated Optimize Dep", D13 gotcha).
- Contrast: cream `#f3e9d2` and gold `#e6b84a` on `#161616` pass AA; muted `#bfb39c` only for secondary text ≥14px.

> **UI Styling Note:** UI styling specifications (colors, sizes, variants, labels, spacing) are `[provisional]` proposals — expect them to change once the user sees the implementation. Implement as specified but do not over-invest in pixel-perfect adherence; plan for iteration.
>
> **Expected UX iterations: 3**
