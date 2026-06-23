// D1 data-access layer for the product catalog. Product attributes
// (category, sizes, colors, tags/badge) are sourced from the taxonomy relations
// (categories, product_sizes/colors/tags); the legacy denormalized columns are
// used only as a fallback. Images are served from R2 at /media/<r2_key>.

export interface ProductImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface ProductColor {
  es: string;
  en: string;
  fr: string;
  hex: string | null;
}

type ML = { es: string; en: string; fr: string };

export interface DbProduct {
  id: number;
  slug: string;
  sku: string;
  name: ML;
  description: ML;
  category: ML;
  categorySlug: string | null;
  badge: ML | null;
  price: number;
  priceUSD: number | null;
  sizes: string[];
  colors: ProductColor[];
  inStock: boolean;
  featured: boolean;
  visible: boolean;
  sortOrder: number;
  images: ProductImage[];
}

export interface LocalizedProduct
  extends Omit<DbProduct, "name" | "description" | "category" | "badge" | "colors"> {
  name: string;
  description: string;
  category: string;
  badge: string | null;
  colors: { name: string; hex: string | null }[];
}

const SAFE_LANGS = new Set(["es", "en", "fr"]);

export function mediaUrl(r2Key: string): string {
  return `/media/${r2Key}`;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(price)
    .replace(/\s/g, "");
}

function csvToArray(value: unknown): string[] {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function ph(ids: number[]): string {
  return ids.map(() => "?").join(",");
}

async function imagesByProduct(db: D1Database, ids: number[]) {
  const map = new Map<number, ProductImage[]>();
  if (!ids.length) return map;
  const res = await db
    .prepare(
      `SELECT product_id, r2_key, alt, width, height FROM product_images
       WHERE product_id IN (${ph(ids)}) ORDER BY position ASC, id ASC`
    )
    .bind(...ids)
    .all();
  for (const r of (res.results as any[]) || []) {
    const list = map.get(Number(r.product_id)) ?? [];
    list.push({
      url: mediaUrl(String(r.r2_key)),
      alt: r.alt ?? undefined,
      width: r.width ?? undefined,
      height: r.height ?? undefined,
    });
    map.set(Number(r.product_id), list);
  }
  return map;
}

async function categoriesById(db: D1Database, ids: number[]) {
  const map = new Map<number, any>();
  const clean = Array.from(new Set(ids.filter(Boolean)));
  if (!clean.length) return map;
  const res = await db
    .prepare(`SELECT * FROM categories WHERE id IN (${ph(clean)})`)
    .bind(...clean)
    .all();
  for (const r of (res.results as any[]) || []) map.set(Number(r.id), r);
  return map;
}

async function relationByProduct(
  db: D1Database,
  ids: number[],
  sql: string
): Promise<Map<number, any[]>> {
  const map = new Map<number, any[]>();
  if (!ids.length) return map;
  const res = await db
    .prepare(sql.replace("__IN__", ph(ids)))
    .bind(...ids)
    .all();
  for (const r of (res.results as any[]) || []) {
    const list = map.get(Number(r.product_id)) ?? [];
    list.push(r);
    map.set(Number(r.product_id), list);
  }
  return map;
}

function mapRow(
  row: any,
  images: ProductImage[],
  category: any | undefined,
  sizes: any[],
  colors: any[],
  tags: any[]
): DbProduct {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    sku: String(row.sku),
    name: { es: row.name_es, en: row.name_en, fr: row.name_fr },
    description: {
      es: row.description_es,
      en: row.description_en,
      fr: row.description_fr,
    },
    category: category
      ? { es: category.name_es, en: category.name_en, fr: category.name_fr }
      : { es: row.category_es, en: row.category_en, fr: row.category_fr },
    categorySlug: category?.slug ?? null,
    badge: tags.length
      ? { es: tags[0].name_es, en: tags[0].name_en, fr: tags[0].name_fr }
      : row.badge
        ? { es: row.badge, en: row.badge, fr: row.badge }
        : null,
    price: Number(row.price),
    priceUSD: row.price_usd == null ? null : Number(row.price_usd),
    sizes: sizes.length ? sizes.map((s) => s.label) : csvToArray(row.sizes),
    colors: colors.length
      ? colors.map((c) => ({
          es: c.name_es,
          en: c.name_en,
          fr: c.name_fr,
          hex: c.hex ?? null,
        }))
      : csvToArray(row.colors).map((n) => ({ es: n, en: n, fr: n, hex: null })),
    inStock: Boolean(row.in_stock),
    featured: Boolean(row.featured),
    visible: Boolean(row.visible),
    sortOrder: Number(row.sort_order ?? 0),
    images,
  };
}

async function attachAll(db: D1Database, rows: any[]): Promise<DbProduct[]> {
  const ids = rows.map((r) => Number(r.id));
  const catIds = rows.map((r) => Number(r.category_id)).filter(Boolean);
  const [imgs, cats, sizes, colors, tags] = await Promise.all([
    imagesByProduct(db, ids),
    categoriesById(db, catIds),
    relationByProduct(
      db,
      ids,
      `SELECT ps.product_id, s.label, s.sort_order FROM product_sizes ps
       JOIN sizes s ON s.id = ps.size_id WHERE ps.product_id IN (__IN__)
       ORDER BY s.sort_order ASC, s.id ASC`
    ),
    relationByProduct(
      db,
      ids,
      `SELECT pc.product_id, c.name_es, c.name_en, c.name_fr, c.hex, c.sort_order
       FROM product_colors pc JOIN colors c ON c.id = pc.color_id
       WHERE pc.product_id IN (__IN__) ORDER BY c.sort_order ASC, c.id ASC`
    ),
    relationByProduct(
      db,
      ids,
      `SELECT pt.product_id, t.name_es, t.name_en, t.name_fr, t.sort_order
       FROM product_tags pt JOIN tags t ON t.id = pt.tag_id
       WHERE pt.product_id IN (__IN__) ORDER BY t.sort_order ASC, t.id ASC`
    ),
  ]);
  return rows.map((r) =>
    mapRow(
      r,
      imgs.get(Number(r.id)) ?? [],
      cats.get(Number(r.category_id)),
      sizes.get(Number(r.id)) ?? [],
      colors.get(Number(r.id)) ?? [],
      tags.get(Number(r.id)) ?? []
    )
  );
}

export async function getProducts(
  db: D1Database,
  opts: { visibleOnly?: boolean } = {}
): Promise<DbProduct[]> {
  const { visibleOnly = true } = opts;
  const res = await db
    .prepare(
      `SELECT * FROM products ${visibleOnly ? "WHERE visible = 1" : ""}
       ORDER BY featured DESC, sort_order ASC, id ASC`
    )
    .all();
  return attachAll(db, (res.results as any[]) || []);
}

export async function getProductBySlug(
  db: D1Database,
  slug: string
): Promise<DbProduct | null> {
  const res = await db
    .prepare(`SELECT * FROM products WHERE slug = ? LIMIT 1`)
    .bind(slug)
    .all();
  const rows = (res.results as any[]) || [];
  if (!rows.length) return null;
  const [p] = await attachAll(db, rows);
  return p ?? null;
}

export async function getFeaturedProducts(
  db: D1Database
): Promise<DbProduct[]> {
  const res = await db
    .prepare(
      `SELECT * FROM products WHERE visible = 1 AND featured = 1
       ORDER BY sort_order ASC, id ASC`
    )
    .all();
  return attachAll(db, (res.results as any[]) || []);
}

export async function getRelatedProducts(
  db: D1Database,
  slug: string,
  limit = 4
): Promise<DbProduct[]> {
  const current = await getProductBySlug(db, slug);
  const all = await getProducts(db, { visibleOnly: true });
  if (!current) return all.slice(0, limit);
  const sameCategory = all.filter(
    (p) => p.category.es === current.category.es && p.slug !== slug
  );
  const featured = all.filter(
    (p) =>
      p.featured && p.slug !== slug && p.category.es !== current.category.es
  );
  return [...sameCategory, ...featured].slice(0, limit);
}

export function getLocalizedProduct(
  product: DbProduct,
  lang: string
): LocalizedProduct {
  const l = (SAFE_LANGS.has(lang) ? lang : "es") as "es" | "en" | "fr";
  return {
    ...product,
    name: product.name[l],
    description: product.description[l],
    category: product.category[l],
    badge: product.badge ? product.badge[l] : null,
    colors: product.colors.map((c) => ({ name: c[l], hex: c.hex })),
  };
}
