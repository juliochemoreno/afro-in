-- Local dev only: the product_images rows that point at the 8 catalog photos
-- already in the staging R2 bucket (afroin-media-preview), which `astro dev` reads
-- through the `env.local` remote binding in wrangler.json. Catalog data only.
--
--   npx wrangler d1 execute DB --local --env local --file seeds/local.sql

INSERT OR IGNORE INTO product_images (product_id, r2_key, content_type, alt, position, width, height) VALUES (1, 'products/camiseta-palenque-2020/main.webp', 'image/webp', 'Camiseta Palenque 2020', 0, NULL, NULL);
INSERT OR IGNORE INTO product_images (product_id, r2_key, content_type, alt, position, width, height) VALUES (10, 'products/camiseta-afroin-classic/main.webp', 'image/webp', 'Camiseta Clásica AFRO IN', 0, NULL, NULL);
INSERT OR IGNORE INTO product_images (product_id, r2_key, content_type, alt, position, width, height) VALUES (9, 'products/camiseta-negra-basica/main.webp', 'image/webp', 'Camiseta Negra AFRO IN', 0, NULL, NULL);
INSERT OR IGNORE INTO product_images (product_id, r2_key, content_type, alt, position, width, height) VALUES (8, 'products/gorra-sencilla/main.webp', 'image/webp', 'Gorra Sencilla', 0, NULL, NULL);
INSERT OR IGNORE INTO product_images (product_id, r2_key, content_type, alt, position, width, height) VALUES (13, 'products/gorra-cafe/main.jpeg', 'image/jpeg', 'Gorra Café', 0, NULL, NULL);
INSERT OR IGNORE INTO product_images (product_id, r2_key, content_type, alt, position, width, height) VALUES (14, 'products/gorra-negra/main.jpeg', 'image/jpeg', 'Gorra Negra', 0, NULL, NULL);
INSERT OR IGNORE INTO product_images (product_id, r2_key, content_type, alt, position, width, height) VALUES (15, 'products/termo-afroin/main.jpeg', 'image/jpeg', 'Termo AFRO IN 90', 0, NULL, NULL);
INSERT OR IGNORE INTO product_images (product_id, r2_key, content_type, alt, position, width, height) VALUES (16, 'products/mug-afroin/main.jpeg', 'image/jpeg', 'Mug AFRO IN', 0, NULL, NULL);
