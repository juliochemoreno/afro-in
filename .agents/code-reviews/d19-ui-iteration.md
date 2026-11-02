# Code review — D19 Level 5 UI iteration (uncommitted diff before the PR)

- Scope: shared email layout, email preview (dev only), ticket email copy/layout, `eventTime` final dot, tickets page redesign (desktop + phone), QR without CDN, pending/failed/notfound states, buyer purchase reference `orderRef()`.
- Reviewer: fresh-context subagent, 2026-11-01. Result: no blocking defects; 3 low findings fixed, notes below. `npm run check` and `npm test` (97/97) green after the fixes.

| # | Finding | Outcome |
|---|---|---|
| 1 | `/api/tickets/confirm` still returned the sequential `id` beside `ref` | Fixed: `id` removed (unused by the client) |
| 2 | Pending icon white on cream in light mode | Fixed: neutral icon uses the page text color |
| 3 | Permalink URL hidden; a failed clipboard copy (in-app browsers) left no way to get it | Fixed: on failure the URL field appears for manual selection |
| — | Wrong comment "Phones keep the full stubs" | Fixed |
| — | Bare "#" if a ref were ever missing | Fixed: the row hides without a ref |
| — | Dead `.tix-success-head` CSS | Removed |
| — | 32-bit ref can collide around 10k orders | Accepted: display only; admin keeps the row id |
| — | Store receipt (`OrderReceipt.tsx`) still shows the sequential id | Out of scope: follow-up |
| — | French mixes "Vos billets" (site strings) and new "tu" strings | Follow-up with D17/site copy |
| — | `<title>` stays "Tus entradas" on error states | Left as is |

Checked fine (reviewer): dev preview compiles to an always-404 handler in the build; preview and email escaping; TicketQR SSR/client output identical (no hydration mismatch); hero title switch outside the island; all i18n keys present in T_KEYS and es/en/fr; print CSS keeps event names; CSS variables defined.
