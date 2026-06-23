import type { APIRoute } from "astro";
import { requireAdmin, adminUnauthorized } from "@/lib/adminAuth";
import {
  isTaxType,
  TAX_CONFIG,
  validateTaxInput,
  taxValues,
} from "@/lib/taxonomy";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const PUT: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const type = ctx.params.type;
  if (!isTaxType(type)) return json({ error: "Tipo inválido" }, 404);
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return json({ error: "id inválido" }, 400);
  const db = (ctx.locals as any).runtime.env.DB;

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const err = validateTaxInput(type, body);
  if (err) return json({ error: err }, 400);

  const cols = TAX_CONFIG[type].columns;
  const setClause = cols.map((c) => `${c} = ?`).join(", ");
  try {
    const res = await db
      .prepare(`UPDATE ${type} SET ${setClause} WHERE id = ?`)
      .bind(...taxValues(type, body), id)
      .run();
    if (res.meta.changes === 0) return json({ error: "No existe" }, 404);
    return json({ id });
  } catch (e: any) {
    if (String(e?.message || e).includes("UNIQUE"))
      return json({ error: "Ya existe (slug o etiqueta duplicada)" }, 409);
    console.error("taxonomy update error:", e);
    return json({ error: "No se pudo actualizar" }, 500);
  }
};

// Whitelisted cleanup of product relations when a taxonomy row is deleted.
const CLEANUP: Record<string, string> = {
  categories: "UPDATE products SET category_id = NULL WHERE category_id = ?",
  tags: "DELETE FROM product_tags WHERE tag_id = ?",
  sizes: "DELETE FROM product_sizes WHERE size_id = ?",
  colors: "DELETE FROM product_colors WHERE color_id = ?",
};

export const DELETE: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const type = ctx.params.type;
  if (!isTaxType(type)) return json({ error: "Tipo inválido" }, 404);
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return json({ error: "id inválido" }, 400);
  const db = (ctx.locals as any).runtime.env.DB;

  await db.prepare(CLEANUP[type]).bind(id).run();
  await db.prepare(`DELETE FROM ${type} WHERE id = ?`).bind(id).run();
  return json({ ok: true });
};
