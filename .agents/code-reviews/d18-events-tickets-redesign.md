# Code review — D18 events, event page and tickets redesign

- **Branch:** `claude/d18-events-redesign-354feb` vs `origin/dev`, reviewed at 1ec7582
- **Reviewer:** fresh-context agent (strongest model), 2026-10-31
- **Checks run by the reviewer:** `npm test` 56/56, `npx tsc --noEmit` clean

## Summary

Nothing serious. The checkout form, receipt, list and QR changes are strings and markup only: the checkout body, Bold handoff, `price_changed`, holds and ticket/order logic are unchanged, and the ids `tix-name`/`tix-email`/`tix-phone` stay. `eventDisplay.ts` reads `event_date` as UTC parts, so no runtime time zone moves the day (also client-side in `TicketQR`). All 14 new i18n keys exist in es/en/fr and the hardcoded Spanish is gone. The dark form overrides are scoped under `.evento-page`, so the store and donation forms are not affected. The QR sits on pure white with a quiet zone in both themes. No `astro:assets` on SSR pages, no `100vw`.

## Findings (all low) and fixes

| # | Finding | Fix |
|---|---|---|
| 1 | A used ticket loses its "USED" stamp when printed (white on a red fill that doesn't print) | Print CSS: black-bordered stamp, no grayscale/opacity |
| 2 | In light mode, hovering the red "Back to events" button turns its text near-black (3.6:1) | Hover rule excludes `.btn` and `.fz-button` |
| 3 | `/entradas` ticket subtitle used the browser locale, not the page language | New `shortDate(eventDate, lang)` helper (UTC parts), used by `TicketReceipt` and the token page; test added |
| 4 | Placeholder contrast below 4.5:1 | `--tx-placeholder` alpha raised (dark 0.58, light 0.62) |
| 5 | No `<h1>` while the receipt is loading/pending/failed | Hero title is the `<h1>`; receipt headings are `<h2>` |
| 6 | Unscoped global `.fz-tier-price` color rule in the event page CSS | Scoped under `.evento-page` |

All six fixed in the follow-up commit.
