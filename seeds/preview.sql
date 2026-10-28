-- Seed for the STAGING D1 (afroin-preview) only. Never run it on production.
-- It lives outside migrations/ so no migration run ever sends it there.
-- Fake rows only (no personal data). The [DEV] product exists only in staging,
-- so seeing it proves a Preview reads the staging database; its price is the
-- Bold minimum, for cheap test purchases. Idempotent (INSERT OR IGNORE).
--
--   npx wrangler d1 execute PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc --file seeds/preview.sql

INSERT OR IGNORE INTO products (slug, sku, name_es, name_en, name_fr, description_es, description_en, description_fr, category_es, category_en, category_fr, price, in_stock, featured, visible, sort_order, category_id) VALUES ('dev-producto-de-prueba', 'DEV-TEST-0001', '[DEV] Producto de prueba', '[DEV] Test product', '[DEV] Produit de test', 'Producto ficticio del entorno de desarrollo. Solo existe en la base de datos de prueba.', 'Fake product of the development environment. It only exists in the test database.', 'Produit fictif de l''environnement de développement. Il n''existe que dans la base de test.', 'accesorios', 'accessories', 'accessoires', 1000, 1, 0, 1, 99, (SELECT id FROM categories WHERE slug = 'accesorios'));
