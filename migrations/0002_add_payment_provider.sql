-- Add payment provider, currency and transaction tracking to donors
-- SQLite (D1) allows only one column per ALTER TABLE statement.

-- Payment provider: 'paypal' (existing flow) or 'bold'
ALTER TABLE donors ADD COLUMN provider TEXT NOT NULL DEFAULT 'paypal';

-- Transaction currency: 'USD' (PayPal) or 'COP' (Bold)
ALTER TABLE donors ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';

-- Bold order identifier (used to match webhook/voucher confirmations)
ALTER TABLE donors ADD COLUMN bold_order_id TEXT;

-- Provider transaction id (PayPal tx or Bold transaction id)
ALTER TABLE donors ADD COLUMN transaction_id TEXT;

-- Raw provider status (APPROVED / REJECTED / FAILED / VOIDED / etc.)
ALTER TABLE donors ADD COLUMN provider_status TEXT;

-- Index for matching Bold confirmations by order id
CREATE INDEX IF NOT EXISTS idx_donors_bold_order ON donors(bold_order_id);

-- Unique partial index guarantees one row per Bold order (webhook idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS idx_donors_bold_order_unique
  ON donors(bold_order_id) WHERE bold_order_id IS NOT NULL;
