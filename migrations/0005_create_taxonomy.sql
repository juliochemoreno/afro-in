-- Managed taxonomy entities related to products: categories (one per product),
-- tags/sizes/colors (many-to-many). Multilingual where it makes sense.

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  name_fr TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  name_fr TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Sizes are universal labels (S, M, 42…), not translated.
CREATE TABLE IF NOT EXISTS sizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS colors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  name_fr TEXT NOT NULL DEFAULT '',
  hex TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- One category per product (many-to-one).
ALTER TABLE products ADD COLUMN category_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- Many-to-many join tables.
CREATE TABLE IF NOT EXISTS product_tags (
  product_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (product_id, tag_id)
);
CREATE TABLE IF NOT EXISTS product_sizes (
  product_id INTEGER NOT NULL,
  size_id INTEGER NOT NULL,
  PRIMARY KEY (product_id, size_id)
);
CREATE TABLE IF NOT EXISTS product_colors (
  product_id INTEGER NOT NULL,
  color_id INTEGER NOT NULL,
  PRIMARY KEY (product_id, color_id)
);
