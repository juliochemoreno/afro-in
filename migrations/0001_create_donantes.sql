-- Donors table for the Million Hearts Movement
CREATE TABLE IF NOT EXISTS donors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  country TEXT,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_donors_email ON donors(email);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_donors_status ON donors(status);
