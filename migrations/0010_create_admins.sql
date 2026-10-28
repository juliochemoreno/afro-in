-- Migration 0010_create_admins.sql
-- Backoffice admin accounts with a salted PBKDF2 hash (see src/lib/adminAuth.ts).
--
-- No account is seeded here: this repository is public, so no password, hash or
-- salt may ever live in it. The first superadmin is created from the admin panel
-- (/admin/administradores) by logging in with the break-glass environment
-- account (ADMIN_USER / ADMIN_PASSWORD secrets).
--
-- Idempotent: production already has this table (created on 2026-10-06 by an
-- earlier version of this file), so every statement uses IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin', -- 'admin' | 'superadmin'
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
