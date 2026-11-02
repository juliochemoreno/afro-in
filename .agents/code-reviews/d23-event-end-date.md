# Code review: D23 optional `end_date` for multi-day events

## Phase 1 (Tasks 1–9), fresh-context subagent review, 2026-11-01

**Scope:** migration 0012; `ticketStages.ts` (eventEndsAt, isEventOver, validateEndDate, validateStages); `tickets.ts` (getVisibleEvents, getEventBySlug, checkout); `eventAdmin.ts`, admin event routes; `EventForm.tsx`, `EventsDashboard.tsx`; `eventDisplay.ts`; `TicketQR.tsx`, `TicketList.tsx`, `TicketReceipt.tsx`, `EntradasTemplate.astro`; tests. `npm test` 72/72.

**Result:** no Critical or High findings.

| # | Severity | Finding | Outcome |
|---|---|---|---|
| M1 | Medium | The new code reads `events.end_date`; deploying before migration 0012 → events list 500, checkout and admin save fail. Old code on the new schema is fine. | Release order documented (plan Notes, PR, report): apply 0012 to production, verify, then release. |
| L1 | Low | `end_date = ''` (manual DB edit only) → SQL keeps the event listed forever while TS treats it as over (404 page). | **Fixed:** `COALESCE(NULLIF(e.end_date, '') || 'T23:59:59', e.event_date)`. |
| L2 | Low | `end_date` before the start day (manual DB edit only) ends the event early; display ignores it. | Not changed: admin client + server refuse it; mirroring in SQL adds complexity. |
| L3 | Low | Server truncates `end_date` to 10 chars before validating (`"2027-01-17xyz"` accepted). | Not changed: the date input cannot produce it; result is a valid date. |
| L4 | Low | An admin tab opened before the release does not send `end_date` and clears it on save (PUT replaces all columns). | Note for Julio: hard-refresh the admin before setting the pass's last day. |
| L5 | Low | Ticket stub block has no month for a range. | Not changed: the subtitle carries month and year (same as one-day events today). |

**Checked and fine:** SQL/TS cutoff agree at 23:59:58 / 23:59:59 / 00:00; every date-based rejection goes through `isEventOver` (grep of `event_date`); paid-order issuing has no date check (correct); `EVENT_COLUMNS`/`eventValues` order and counts (17); empty → NULL on client and server; same validation on both sides; UTC-based formatting, no day shift; admin "Pasado" now in Bogotá time; stub `.is-range` layout and print.

## Full branch, fresh-context review, 2026-11-01

**Scope:** `origin/dev...HEAD` (phase 1, the old-tab end_date fix, merge of dev with PR #23, phase 2, desktop tickets page). `npm test` 75/75.

**Result:** no Critical or High findings.

| # | Severity | Finding | Outcome |
|---|---|---|---|
| M1 | Medium | An old admin tab (no `end_date` key) that moves the event later keeps a stored last day on or before the new start → event hidden and sales closed early. | **Fixed:** the PUT reads the stored `end_date` when the key is missing and clears it if `validateEndDate` refuses it against the new start date. |
| M2 | Medium | `.tix-wrap` widened to 940px for every phase, so pending/failed receipt boxes grew too. | **Fixed:** `.tix-wrap:has(.tix-list)` only. |
| L1 | Low | `display: contents` on the `<aside>` may drop its landmark on phones. | Not changed: only order info and actions, single column, no focus-order change. |
| L2 | Low | "Hasta dom 17 · 9:00 p. m." could read as "until 9 pm Sunday". | Not changed: wording chosen by Julio; revisit if users are confused. |

**Checked and fine:** SQL/TS cutoff identical (NULL and '' fall back to `event_date`); only gate sites are `getVisibleEvents`, `getEventBySlug`, checkout, admin "Pasado"; `EVENT_COLUMNS`/`eventValues` 17/17; client and server validation; UTC-based helpers in es/en/fr; merged templates reference no removed variables; mobile order, desktop grid and sticky panel; print shows only tickets; pass season 2027-01-17.
