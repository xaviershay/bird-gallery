-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- Add some initial data
INSERT INTO items (name, description, created_at) VALUES 
  ('Example Item 1', 'This is the first example item', '2025-04-21T00:00:00Z'),
  ('Example Item 2', 'This is the second example item', '2025-04-21T00:00:00Z');