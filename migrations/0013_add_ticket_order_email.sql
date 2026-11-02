-- Ticket confirmation email (D19). The buyer's language and the state of the
-- one email each completed order sends (lib/ticketEmailSend.ts):
--   email_status: NULL = due | sending | sent | failed | skipped
-- A claim (NULL/failed/stale sending -> sending) makes the send happen once
-- even when the Bold webhook and the receipt confirm race.
-- Additive only: code that does not know these columns keeps working.
ALTER TABLE ticket_orders ADD COLUMN locale TEXT;            -- es | en | fr, NULL = es
ALTER TABLE ticket_orders ADD COLUMN email_status TEXT;
ALTER TABLE ticket_orders ADD COLUMN email_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ticket_orders ADD COLUMN email_attempt_at TEXT;  -- UTC datetime('now') of the last claim
ALTER TABLE ticket_orders ADD COLUMN email_sent_at TEXT;
ALTER TABLE ticket_orders ADD COLUMN email_error TEXT;       -- last failure (HTTP status + message)

-- Orders completed before this release never get an automatic email; the
-- admin can still send it from the order detail.
UPDATE ticket_orders SET email_status = 'skipped' WHERE status = 'completed';
