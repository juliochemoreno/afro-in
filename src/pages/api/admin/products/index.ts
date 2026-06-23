import type { APIRoute } from "astro";
import { requireAdmin, adminUnauthorized } from "@/lib/adminAuth";
import {
  validateProductInput,
  productFields,
  fieldValues,
  PRODUCT_COLUMNS,
  syncProductImages,
  denormalizeTaxonomy,
} from "@/lib/productAdmin";
import { syncProductRelation } from "@/lib/taxonomy";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// GET: full catalog (including hidden) with images, for the admin table.
export const GET: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const db = (ctx.locals as any).runtime.env.DB;

  const prods = await db
    .prepare("SELECT * FROM products ORDER BY sort_order ASC, id ASC")
    .all();
  const imgs = await db
    .prepare(
      "SELECT id, product_id, r2_key, content_type, alt, position FROM product_images ORDER BY position ASC, id ASC"
    )
    .all();

  const byProduct = new Map<number, any[]>();
  for (const im of (imgs.results as any[]) || []) {
    const list = byProduct.get(im.product_id) ?? [];
    list.push({
      id: im.id,
      r2_key: im.r2_key,
      content_type: im.content_type,
      url: `/media/${im.r2_key}`,
      alt: im.alt,
      position: im.position,
    });
    byProduct.set(im.product_id, list);
  }

  const products = ((prods.results as any[]) || []).map((p) => ({
    ...p,
    images: byProduct.get(p.id) ?? [],
  }));

  return json({ products });
};

// POST: create a product (+ its images).
export const POST: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const db = (ctx.locals as any).runtime.env.DB;
  const env = (ctx.locals as any).runtime.env;

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const err = validateProductInput(body);
  if (err) return json({ error: err }, 400);

  const fields = productFields(body);
  const denorm = await denormalizeTaxonomy(db, body);
  fields.category_es = denorm.category_es;
  fields.category_en = denorm.category_en;
  fields.category_fr = denorm.category_fr;
  fields.sizes = denorm.sizes;
  fields.colors = denorm.colors;
  fields.badge = denorm.badge;
  const placeholders = PRODUCT_COLUMNS.map(() => "?").join(", ");

  try {
    const res = await db
      .prepare(
        `INSERT INTO products (${PRODUCT_COLUMNS.join(", ")}, category_id, updated_at)
         VALUES (${placeholders}, ?, CURRENT_TIMESTAMP)`
      )
      .bind(...fieldValues(fields), denorm.category_id)
      .run();
    const id = Number(res.meta.last_row_id);
    await syncProductImages(db, env, id, body.images);
    await syncProductRelation(db, "tags", id, body.tag_ids);
    await syncProductRelation(db, "sizes", id, body.size_ids);
    await syncProductRelation(db, "colors", id, body.color_ids);
    return json({ id }, 201);
  } catch (e: any) {
    if (String(e?.message || e).includes("UNIQUE"))
      return json({ error: "El slug o el SKU ya existe" }, 409);
    console.error("create product error:", e);
    return json({ error: "No se pudo crear el producto" }, 500);
  }
};
