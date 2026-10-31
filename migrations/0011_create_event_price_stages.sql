-- Staged ticket prices (D13). An event may have price stages (presales), each
-- with its own price, quota and Bogotá date range; the checkout charges the
-- current stage's price (lib/ticketStages.ts picks it). Events without stages
-- keep selling at events.price.
-- Additive only: code that does not know about stages keeps working.

CREATE TABLE IF NOT EXISTS event_price_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name_es TEXT NOT NULL,
  name_en TEXT,
  name_fr TEXT,
  price INTEGER NOT NULL,                          -- COP
  capacity INTEGER NOT NULL,                       -- tickets this stage may sell
  starts_on TEXT NOT NULL,                         -- YYYY-MM-DD, Bogotá, inclusive
  ends_on TEXT,                                    -- YYYY-MM-DD inclusive; NULL = until the event
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_event_price_stages_event ON event_price_stages(event_id, starts_on);

-- The stage an order was priced at (NULL: unstaged event or courtesy).
ALTER TABLE ticket_orders ADD COLUMN stage_id INTEGER REFERENCES event_price_stages(id);

CREATE INDEX IF NOT EXISTS idx_ticket_orders_stage ON ticket_orders(stage_id);
-- Pending orders hold their tickets for 30 minutes (capacity checks read this).
CREATE INDEX IF NOT EXISTS idx_ticket_orders_pending ON ticket_orders(event_id, status, created_at);
