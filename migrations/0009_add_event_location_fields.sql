-- Add department and country to events table
ALTER TABLE events ADD COLUMN department TEXT;
ALTER TABLE events ADD COLUMN country TEXT DEFAULT 'Colombia';
