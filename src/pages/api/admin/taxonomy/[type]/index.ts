import type { APIRoute } from "astro";
import { requireAdmin, adminUnauthorized } from "@/lib/adminAuth";
import {
  isTaxType,
  TAX_CONFIG,
  getTaxonomy,
  validateTaxInput,
  taxValues,
} from "@/lib/taxonomy";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const GET: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const type = ctx.params.type;
  if (!isTaxType(type)) return json({ error: "Tipo inválido" }, 404);
  const db = (ctx.locals as any).runtime.env.DB;
  return json({ items: await getTaxonomy(db, type) });
};

export const POST: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const type = ctx.params.type;
  if (!isTaxType(type)) return json({ error: "Tipo inválido" }, 404);
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
  const placeholders = cols.map(() => "?").join(", ");
  try {
    const res = await db
      .prepare(`INSERT INTO ${type} (${cols.join(", ")}) VALUES (${placeholders})`)
      .bind(...taxValues(type, body))
      .run();
    return json({ id: res.meta.last_row_id }, 201);
  } catch (e: any) {
    if (String(e?.message || e).includes("UNIQUE"))
      return json({ error: "Ya existe (slug o etiqueta duplicada)" }, 409);
    console.error("taxonomy create error:", e);
    return json({ error: "No se pudo crear" }, 500);
  }
};
