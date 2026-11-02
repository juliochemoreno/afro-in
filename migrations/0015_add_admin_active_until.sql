-- Door-only users (D26). active_until is the last door day (YYYY-MM-DD,
-- Bogotá, inclusive, rolls over at 06:00 like lib/doorDay.ts) a role 'door'
-- account may log in and scan. NULL for 'admin' / 'superadmin'.
-- Additive only: code that does not know about active_until keeps working.
-- Not idempotent (ALTER TABLE ADD COLUMN): never re-run it. Production gets it
-- BEFORE the code that reads it (that code fails closed without the column).
ALTER TABLE admins ADD COLUMN active_until TEXT;
