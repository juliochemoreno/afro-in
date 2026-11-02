# Code review — D25 daily check-in

Fresh-context review (separate agent, Opus 5.5) of the uncommitted D25 diff, 2026-11-01. No critical or high findings.

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | medium | A multi-day ticket checked in under the old one-entry rule has no `ticket_checkins` row, so it could enter a second time that door day after the release. | Fixed. `0014` backfills those tickets with the door day of `checked_in_at` (`date(checked_in_at, '-11 hours')`). It is re-runnable, verified on local D1. |
| 2 | medium | If the code is released before `0014` runs, multi-day buyer pages, admin detail and scans fail with "no such table". Single-day events are unaffected. | Deploy order documented: Julio runs `0014` in production first, then the release. |
| 3 | low | A multi-day event whose `event_date` starts between 00:00 and 05:59 would reject its own first-night scans (the start is the calendar date). | Not changed. The plan's domain rule (approved) says day 1 is the date of `event_date`, and no such event exists. Recorded as a known limit. |
| 4 | low | The admin `formatDate` used the browser's time zone; the new "Día N · …" lines make the date prominent. | Fixed. `timeZone: "America/Bogota"` added. |
| 5 | low | No automated test for the SQL path (`checkInForDoorDay`). | Covered by the Level 4 run on local D1: concurrent double scan gives one `ok` and one `already`; every branch checked. No D1 test harness in the repo (adding one needs a new dependency). |
| 6 | note | `meta.changes` on `INSERT OR IGNORE` inside `db.batch` is the claim signal. | Confirmed on local D1 (miniflare): 1 on insert, 0 when ignored. |

Areas found sound: day math (rollover, month/year boundaries, 01:30 counts as the previous day), NULL/empty `end_date`, LEFT JOIN, admin counts unchanged, single-day path unchanged, other callers of `loadTicketOrderView`, type parity between `CheckInResult` and the scanner's `Verdict`, migration idempotency.
