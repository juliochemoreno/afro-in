-- Seed for the STAGING D1 (afroin-preview) only. Never run it on production.
-- It lives outside migrations/ so no migration run ever sends it there.
-- Fake rows only (no personal data). The [DEV] product exists only in staging,
-- so seeing it proves a Preview reads the staging database; its price is the
-- Bold minimum, for cheap test purchases. Idempotent (INSERT OR IGNORE).
--
--   npx wrangler d1 execute PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc --file seeds/preview.sql

INSERT OR IGNORE INTO products (slug, sku, name_es, name_en, name_fr, description_es, description_en, description_fr, category_es, category_en, category_fr, price, in_stock, featured, visible, sort_order, category_id) VALUES ('dev-producto-de-prueba', 'DEV-TEST-0001', '[DEV] Producto de prueba', '[DEV] Test product', '[DEV] Produit de test', 'Producto ficticio del entorno de desarrollo. Solo existe en la base de datos de prueba.', 'Fake product of the development environment. It only exists in the test database.', 'Produit fictif de l''environnement de développement. Il n''existe que dans la base de test.', 'accesorios', 'accessories', 'accessoires', 1000, 1, 0, 1, 99, (SELECT id FROM categories WHERE slug = 'accesorios'));

-- Ticketing (D1). Two fake events at the Bold minimum (1,000 COP) for test
-- purchases: one on sale, one sold out (capacity 1, taken by a fake courtesy
-- ticket). Fixed ids/codes keep these inserts idempotent.
INSERT OR IGNORE INTO events (slug, name_es, name_en, name_fr, description_es, description_en, description_fr, venue, city, department, country, event_date, price, capacity, visible) VALUES ('dev-evento-de-prueba', '[DEV] Evento de prueba', '[DEV] Test event', '[DEV] Événement de test', 'Evento ficticio del entorno de desarrollo. Solo existe en la base de datos de prueba.', 'Fake event of the development environment. It only exists in the test database.', 'Événement fictif de l''environnement de développement. Il n''existe que dans la base de test.', 'Lugar de prueba', 'Santa Marta', 'Magdalena', 'Colombia', '2027-06-01T20:00', 1000, 20, 1);
INSERT OR IGNORE INTO events (slug, name_es, name_en, name_fr, description_es, description_en, description_fr, venue, city, department, country, event_date, price, capacity, visible) VALUES ('dev-evento-agotado', '[DEV] Evento agotado', '[DEV] Sold-out event', '[DEV] Événement complet', 'Evento ficticio sin cupo, para probar el estado agotado.', 'Fake event with no seats left, to test the sold-out state.', 'Événement fictif complet, pour tester l''état complet.', 'Lugar de prueba', 'Santa Marta', 'Magdalena', 'Colombia', '2027-06-01T20:00', 1000, 1, 1);
INSERT OR IGNORE INTO ticket_orders (bold_order_id, status, provider, provider_status, currency, amount, event_id, event_name, unit_price, quantity, buyer_name, buyer_email, access_token, tickets_issued, paid_at) VALUES ('AFROIN-TIX-00000000-0000-4000-8000-000000000001', 'completed', 'courtesy', 'COMPLIMENTARY', 'COP', 0, (SELECT id FROM events WHERE slug = 'dev-evento-agotado'), '[DEV] Evento agotado', 0, 1, '[DEV] Asistente de prueba', 'dev@example.com', '00000000-0000-4000-8000-0000000000aa', 1, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO tickets (ticket_order_id, event_id, code, status) SELECT id, event_id, 'DEV0000001', 'valid' FROM ticket_orders WHERE bold_order_id = 'AFROIN-TIX-00000000-0000-4000-8000-000000000001';
