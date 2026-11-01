-- Multi-day events (D23). end_date is the event's last day (YYYY-MM-DD,
-- Bogotá, inclusive): the event stays visible and on sale until that day ends
-- (lib/ticketStages.ts eventEndsAt). NULL = one-day event, on sale until
-- event_date as before.
-- Additive only: code that does not know about end_date keeps working.
ALTER TABLE events ADD COLUMN end_date TEXT;
