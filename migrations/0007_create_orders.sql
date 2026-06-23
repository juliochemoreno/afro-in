-- Store orders paid through Bold. Mirrors the donors table's Bold columns
-- (status/provider_status/transaction_id/bold_order_id) so confirmBoldOrder can
-- update either table with the same idempotent UPDATE. Amounts are integer COP.

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bold_order_id TEXT NOT NULL UNIQUE,           -- AFROIN-ORD-<uuid>
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | completed | rejected
  provider TEXT NOT NULL DEFAULT 'bold',
  provider_status TEXT,                          -- raw Bold status
  transaction_id TEXT,
  currency TEXT NOT NULL DEFAULT 'COP',
  amount INTEGER NOT NULL,                        -- total charged (COP, == subtotal in v1)
  subtotal INTEGER NOT NULL,                      -- sum of line totals (COP)
  item_count INTEGER NOT NULL DEFAULT 0,         -- total units, for quick admin display

  -- Customer
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,

  -- Shipping address (collected at checkout)
  ship_country TEXT,
  ship_department TEXT,                           -- state / department
  ship_city TEXT,
  ship_address TEXT,                              -- street + number
  ship_notes TEXT,                                -- apt, references, instructions

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- One row per cart line. Name/price are snapshotted at purchase time so the
-- order is immutable even if the product is later edited or deleted.
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER,                             -- nullable: product may be deleted later
  slug TEXT,
  sku TEXT,
  name TEXT NOT NULL,                             -- snapshot
  size TEXT,
  color TEXT,
  unit_price INTEGER NOT NULL,                    -- COP at purchase (server-side price)
  quantity INTEGER NOT NULL,
  line_total INTEGER NOT NULL                     -- unit_price * quantity
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
