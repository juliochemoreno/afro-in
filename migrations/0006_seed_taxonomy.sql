-- Seed the taxonomy from the current product data and wire the 8 existing
-- products to their relations. Idempotent (INSERT OR IGNORE).

INSERT OR IGNORE INTO categories (slug, name_es, name_en, name_fr, sort_order) VALUES
  ('ropa', 'Ropa', 'Clothing', 'Vêtements', 0),
  ('gorras', 'Gorras', 'Caps', 'Casquettes', 1),
  ('accesorios', 'Accesorios', 'Accessories', 'Accessoires', 2);

INSERT OR IGNORE INTO tags (slug, name_es, name_en, name_fr, sort_order) VALUES
  ('premium', 'Premium', 'Premium', 'Premium', 0),
  ('bestseller', 'Bestseller', 'Bestseller', 'Bestseller', 1),
  ('nuevo', 'Nuevo', 'New', 'Nouveau', 2),
  ('popular', 'Popular', 'Popular', 'Populaire', 3);

INSERT OR IGNORE INTO sizes (label, sort_order) VALUES
  ('S', 0), ('M', 1), ('L', 2), ('XL', 3);

INSERT OR IGNORE INTO colors (slug, name_es, name_en, name_fr, hex, sort_order) VALUES
  ('negro', 'Negro', 'Black', 'Noir', '#000000', 0),
  ('cafe', 'Café', 'Brown', 'Marron', '#6f4e37', 1),
  ('blanco', 'Blanco', 'White', 'Blanc', '#ffffff', 2);

-- product -> category
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug='ropa') WHERE id IN (1, 9, 10);
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug='gorras') WHERE id IN (8, 13, 14);
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug='accesorios') WHERE id IN (15, 16);

-- product -> sizes (the three shirts carry S/M/L/XL)
INSERT OR IGNORE INTO product_sizes (product_id, size_id)
  SELECT p.id, s.id FROM products p JOIN sizes s ON s.label IN ('S','M','L','XL')
  WHERE p.id IN (1, 9, 10);

-- product -> tags (from the legacy single badge)
INSERT OR IGNORE INTO product_tags (product_id, tag_id) VALUES
  (1, (SELECT id FROM tags WHERE slug='premium')),
  (10, (SELECT id FROM tags WHERE slug='bestseller')),
  (13, (SELECT id FROM tags WHERE slug='nuevo')),
  (14, (SELECT id FROM tags WHERE slug='popular')),
  (15, (SELECT id FROM tags WHERE slug='nuevo'));
