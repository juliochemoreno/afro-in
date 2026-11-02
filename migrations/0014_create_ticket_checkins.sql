-- One check-in per day for multi-day events (D25). A pass (events.end_date
-- set) is valid once per Bogotá door day between event_date and end_date; the
-- door day rolls over at 06:00 (lib/doorDay.ts), so a night past midnight is
-- one day. One row per ticket per door day; the primary key makes the INSERT
-- the atomic claim against double entry on concurrent scans.
-- Single-day events never write here: they keep tickets.status/checked_in_at.
-- Additive only: code that does not know about this table keeps working.
CREATE TABLE IF NOT EXISTS ticket_checkins (
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  door_day TEXT NOT NULL,                          -- YYYY-MM-DD, Bogotá door day
  checked_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, -- UTC
  PRIMARY KEY (ticket_id, door_day)
);

-- Backfill: a multi-day ticket already checked in under the old one-entry rule
-- keeps that entry for its door day (Bogotá UTC-5, minus the 06:00 rollover =
-- 11 hours before UTC), so it cannot enter twice that day. Re-runnable.
INSERT OR IGNORE INTO ticket_checkins (ticket_id, door_day, checked_in_at)
SELECT t.id, date(t.checked_in_at, '-11 hours'), t.checked_in_at
FROM tickets t
JOIN events e ON e.id = t.event_id
WHERE t.status = 'checked_in'
  AND t.checked_in_at IS NOT NULL
  AND e.end_date IS NOT NULL AND e.end_date > substr(e.event_date, 1, 10);
