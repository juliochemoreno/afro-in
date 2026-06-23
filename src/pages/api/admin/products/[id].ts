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

// PUT: update a product (+ reconcile its images).
export const PUT: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const db = (ctx.locals as any).runtime.env.DB;
  const env = (ctx.locals as any).runtime.env;
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return json({ error: "id inválido" }, 400);

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
  const setClause = PRODUCT_COLUMNS.map((c) => `${c} = ?`).join(", ");

  try {
    const res = await db
      .prepare(
        `UPDATE products SET ${setClause}, category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      )
      .bind(...fieldValues(fields), denorm.category_id, id)
      .run();
    if (res.meta.changes === 0) return json({ error: "No existe" }, 404);
    await syncProductImages(db, env, id, body.images);
    await syncProductRelation(db, "tags", id, body.tag_ids);
    await syncProductRelation(db, "sizes", id, body.size_ids);
    await syncProductRelation(db, "colors", id, body.color_ids);
    return json({ id });
  } catch (e: any) {
    if (String(e?.message || e).includes("UNIQUE"))
      return json({ error: "El slug o el SKU ya existe" }, 409);
    console.error("update product error:", e);
    return json({ error: "No se pudo actualizar" }, 500);
  }
};

// DELETE: remove a product, its image rows and the R2 objects.
// Lightweight inline toggle of a boolean flag (in_stock/visible/featured)
// without touching images or relations.
const FLAG_FIELDS = ["in_stock", "visible", "featured"];

export const PATCH: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return json({ error: "id inválido" }, 400);
  const db = (ctx.locals as any).runtime.env.DB;

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const updates = FLAG_FIELDS.filter((f) => f in body);
  if (updates.length === 0) return json({ error: "Nada que actualizar" }, 400);

  const setClause = updates.map((f) => `${f} = ?`).join(", ");
  const values = updates.map((f) => (body[f] ? 1 : 0));
  const res = await db
    .prepare(
      `UPDATE products SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
    .bind(...values, id)
    .run();
  if (res.meta.changes === 0) return json({ error: "No existe" }, 404);
  return json({ ok: true });
};

export const DELETE: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const db = (ctx.locals as any).runtime.env.DB;
  const env = (ctx.locals as any).runtime.env;
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return json({ error: "id inválido" }, 400);

  const imgs = await db
    .prepare("SELECT r2_key FROM product_images WHERE product_id = ?")
    .bind(id)
    .all();
  for (const im of (imgs.results as any[]) || []) {
    try {
      await env.MEDIA?.delete(im.r2_key);
    } catch {
      /* ignore */
    }
  }
  await db
    .prepare("DELETE FROM product_images WHERE product_id = ?")
    .bind(id)
    .run();
  await db.prepare("DELETE FROM products WHERE id = ?").bind(id).run();

  return json({ ok: true });
};
