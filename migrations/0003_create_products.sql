-- Product catalog managed via the admin UI (replaces the static
-- src/data/products.ts array). Multilingual fields are flattened into
-- per-language columns (es/en/fr) to match the existing {es,en,fr} contract
-- and allow ORDER BY / LIKE without JSON parsing.

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  sku TEXT NOT NULL UNIQUE,
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  name_fr TEXT NOT NULL DEFAULT '',
  description_es TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  description_fr TEXT NOT NULL DEFAULT '',
  category_es TEXT NOT NULL DEFAULT '',
  category_en TEXT NOT NULL DEFAULT '',
  category_fr TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,          -- COP, integer (Bold requires integer, min 1000)
  price_usd INTEGER,              -- optional USD reference
  badge TEXT,                     -- mapped to i18n key store.badge.<badge>
  sizes TEXT,                     -- CSV, e.g. "S,M,L,XL"
  colors TEXT,                    -- CSV
  in_stock INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,   -- published vs hidden, separate from stock
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_visible_featured
  ON products(visible, featured);
CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort_order);

-- One row per product image. The bytes live in the R2 bucket MEDIA under r2_key;
-- the public URL is /media/<r2_key>, served by src/pages/media/[...key].ts with
-- an immutable Cache-Control so the edge caches them after the first hit.
-- position 0 is the main image.
CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL UNIQUE,                    -- object key in the MEDIA bucket
  content_type TEXT NOT NULL DEFAULT 'image/webp',
  alt TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_images_product
  ON product_images(product_id, position);
