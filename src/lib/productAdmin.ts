// Server-side helpers for the product CMS endpoints (validation + image sync).
// Images are decoupled from product existence: the upload endpoint puts bytes
// in R2 and returns an r2_key; create/update receive an `images` array and this
// module reconciles the product_images rows (and deletes orphaned R2 objects).

export interface ProductImageInput {
  r2_key: string;
  content_type?: string;
  alt?: string;
}

export function validateProductInput(b: any): string | null {
  if (!b || typeof b !== "object") return "Cuerpo inválido";
  if (!b.slug || !/^[a-z0-9-]+$/.test(String(b.slug)))
    return "Slug inválido (solo minúsculas, números y guiones)";
  if (!b.sku || !String(b.sku).trim()) return "SKU requerido";
  if (!b.name_es || !String(b.name_es).trim())
    return "El nombre en español es obligatorio";
  const price = Number(b.price);
  if (!Number.isFinite(price) || price < 1000)
    return "El precio debe ser un entero ≥ 1000 (COP)";
  return null;
}

const toInt = (v: any) =>
  v === null || v === undefined || v === "" ? null : Math.trunc(Number(v));

export function productFields(b: any) {
  return {
    slug: String(b.slug).trim(),
    sku: String(b.sku).trim(),
    name_es: String(b.name_es).trim(),
    name_en: String(b.name_en || "").trim(),
    name_fr: String(b.name_fr || "").trim(),
    description_es: String(b.description_es || ""),
    description_en: String(b.description_en || ""),
    description_fr: String(b.description_fr || ""),
    category_es: String(b.category_es || "").trim(),
    category_en: String(b.category_en || "").trim(),
    category_fr: String(b.category_fr || "").trim(),
    price: Math.trunc(Number(b.price)),
    price_usd: toInt(b.price_usd),
    badge: b.badge ? String(b.badge).trim() : null,
    sizes: b.sizes ? String(b.sizes).trim() : null,
    colors: b.colors ? String(b.colors).trim() : null,
    in_stock: b.in_stock ? 1 : 0,
    featured: b.featured ? 1 : 0,
    visible: b.visible ? 1 : 0,
    sort_order: toInt(b.sort_order) ?? 0,
  };
}

export const PRODUCT_COLUMNS = [
  "slug",
  "sku",
  "name_es",
  "name_en",
  "name_fr",
  "description_es",
  "description_en",
  "description_fr",
  "category_es",
  "category_en",
  "category_fr",
  "price",
  "price_usd",
  "badge",
  "sizes",
  "colors",
  "in_stock",
  "featured",
  "visible",
  "sort_order",
] as const;

export function fieldValues(f: ReturnType<typeof productFields>) {
  return PRODUCT_COLUMNS.map((c) => (f as any)[c]);
}

// Reconcile product_images rows against the submitted image list: delete
// removed images (and their R2 objects), insert new ones, and refresh order.
export async function syncProductImages(
  db: D1Database,
  env: any,
  productId: number,
  images: ProductImageInput[] | undefined
): Promise<void> {
  const submitted = (images || []).filter((i) => i && i.r2_key);
  const existing = await db
    .prepare("SELECT id, r2_key FROM product_images WHERE product_id = ?")
    .bind(productId)
    .all();
  const existingRows = (existing.results || []) as {
    id: number;
    r2_key: string;
  }[];
  const submittedKeys = new Set(submitted.map((i) => i.r2_key));

  for (const ex of existingRows) {
    if (!submittedKeys.has(ex.r2_key)) {
      try {
        await env.MEDIA?.delete(ex.r2_key);
      } catch {
        /* ignore R2 delete failures */
      }
      await db
        .prepare("DELETE FROM product_images WHERE id = ?")
        .bind(ex.id)
        .run();
    }
  }

  const existingKeys = new Set(existingRows.map((e) => e.r2_key));
  let pos = 0;
  for (const im of submitted) {
    if (!existingKeys.has(im.r2_key)) {
      await db
        .prepare(
          "INSERT INTO product_images (product_id, r2_key, content_type, alt, position) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(
          productId,
          im.r2_key,
          im.content_type || "image/webp",
          im.alt || null,
          pos
        )
        .run();
    } else {
      await db
        .prepare(
          "UPDATE product_images SET position = ? WHERE product_id = ? AND r2_key = ?"
        )
        .bind(pos, productId, im.r2_key)
        .run();
    }
    pos++;
  }
}

const intIds = (arr: any): number[] =>
  Array.from(
    new Set(((arr as any[]) || []).map((n) => Math.trunc(Number(n))).filter(Boolean))
  );

// Bridge: until the store reads taxonomy relations directly (Phase D), keep the
// legacy denormalized columns (category_es/en/fr, sizes, colors, badge) in sync
// from the selected taxonomy ids so the public store stays correct.
export async function denormalizeTaxonomy(
  db: D1Database,
  body: any
): Promise<{
  category_id: number | null;
  category_es: string;
  category_en: string;
  category_fr: string;
  sizes: string;
  colors: string;
  badge: string | null;
}> {
  let category_id = body.category_id ? Math.trunc(Number(body.category_id)) : null;
  let cat = { es: "", en: "", fr: "" };
  if (category_id) {
    const c = await db
      .prepare("SELECT name_es, name_en, name_fr FROM categories WHERE id = ?")
      .bind(category_id)
      .first<{ name_es: string; name_en: string; name_fr: string }>();
    if (c) cat = { es: c.name_es, en: c.name_en, fr: c.name_fr };
    else category_id = null;
  }

  const sizeIds = intIds(body.size_ids);
  let sizes = "";
  if (sizeIds.length) {
    const ph = sizeIds.map(() => "?").join(",");
    const r = await db
      .prepare(`SELECT label FROM sizes WHERE id IN (${ph}) ORDER BY sort_order ASC, id ASC`)
      .bind(...sizeIds)
      .all();
    sizes = ((r.results as any[]) || []).map((x) => x.label).join(",");
  }

  const colorIds = intIds(body.color_ids);
  let colors = "";
  if (colorIds.length) {
    const ph = colorIds.map(() => "?").join(",");
    const r = await db
      .prepare(`SELECT name_es FROM colors WHERE id IN (${ph}) ORDER BY sort_order ASC, id ASC`)
      .bind(...colorIds)
      .all();
    colors = ((r.results as any[]) || []).map((x) => x.name_es).join(",");
  }

  const tagIds = intIds(body.tag_ids);
  let badge: string | null = null;
  if (tagIds.length) {
    const c = await db
      .prepare("SELECT name_es FROM tags WHERE id = ?")
      .bind(tagIds[0])
      .first<{ name_es: string }>();
    badge = c?.name_es ?? null;
  }

  return {
    category_id,
    category_es: cat.es,
    category_en: cat.en,
    category_fr: cat.fr,
    sizes,
    colors,
    badge,
  };
}
