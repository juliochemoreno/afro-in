-- Event ticketing (Phase 3). Three tables:
--   events        — sellable events (single price + capacity in v1)
--   ticket_orders — one row per Bold ticket purchase; mirrors the orders/donors
--                   Bold columns so confirmBoldOrder can update it with the same
--                   idempotent UPDATE (status/provider_status/transaction_id/paid_at).
--   tickets       — one row per issued ticket (individual QR + check-in).
-- Amounts are integer COP.

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_es TEXT NOT NULL,
  name_en TEXT,
  name_fr TEXT,
  description_es TEXT,
  description_en TEXT,
  description_fr TEXT,
  venue TEXT,
  city TEXT,
  event_date TEXT NOT NULL,                       -- ISO 8601, e.g. 2026-01-17T20:00
  price INTEGER NOT NULL,                          -- COP
  capacity INTEGER NOT NULL,
  image_r2_key TEXT,
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_visible_date ON events(visible, event_date);

-- A ticket purchase paid through Bold. The Bold contract columns
-- (bold_order_id/status/provider_status/transaction_id/paid_at) are named EXACTLY
-- as in the orders table so confirmBoldOrder's whitelisted UPDATE works unchanged.
CREATE TABLE IF NOT EXISTS ticket_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bold_order_id TEXT NOT NULL UNIQUE,             -- AFROIN-TIX-<uuid>
  status TEXT NOT NULL DEFAULT 'pending',         -- pending | completed | rejected
  provider TEXT NOT NULL DEFAULT 'bold',
  provider_status TEXT,                            -- raw Bold status
  transaction_id TEXT,
  currency TEXT NOT NULL DEFAULT 'COP',
  amount INTEGER NOT NULL,                         -- total charged (COP)

  event_id INTEGER NOT NULL REFERENCES events(id),
  event_name TEXT NOT NULL,                        -- snapshot of events.name_es
  unit_price INTEGER NOT NULL,                     -- snapshot of events.price
  quantity INTEGER NOT NULL,

  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT,

  access_token TEXT NOT NULL UNIQUE,              -- permanent-link bearer token
  tickets_issued INTEGER NOT NULL DEFAULT 0,      -- atomic claim: 1 once tickets are emitted
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ticket_orders_status ON ticket_orders(status);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_event ON ticket_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_token ON ticket_orders(access_token);

-- One row per issued ticket. Created ONLY after payment completes (idempotently).
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_order_id INTEGER NOT NULL REFERENCES ticket_orders(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,                       -- 10-char Crockford base32, manual-entry friendly
  status TEXT NOT NULL DEFAULT 'valid',           -- valid | checked_in
  checked_in_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tickets_order ON tickets(ticket_order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_code ON tickets(code);
