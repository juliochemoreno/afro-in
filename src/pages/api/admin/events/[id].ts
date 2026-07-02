import type { APIRoute } from "astro";
import { requireAdmin, adminUnauthorized } from "@/lib/adminAuth";
import { EVENT_COLUMNS, eventValues, validateEventInput } from "@/lib/eventAdmin";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// PUT: update an event.
export const PUT: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const db = (ctx.locals as any).runtime.env.DB;
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return json({ error: "id inválido" }, 400);

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const err = validateEventInput(body);
  if (err) return json({ error: err }, 400);

  const setClause = EVENT_COLUMNS.map((c) => `${c} = ?`).join(", ");
  try {
    const res = await db
      .prepare(
        `UPDATE events SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      )
      .bind(...eventValues(body), id)
      .run();
    if (res.meta.changes === 0) return json({ error: "No existe" }, 404);
    return json({ id });
  } catch (e: any) {
    if (String(e?.message || e).includes("UNIQUE"))
      return json({ error: "El slug ya existe" }, 409);
    console.error("update event error:", e);
    return json({ error: "No se pudo actualizar" }, 500);
  }
};

// PATCH: lightweight toggle of the `visible` flag.
export const PATCH: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const db = (ctx.locals as any).runtime.env.DB;
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return json({ error: "id inválido" }, 400);

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  if (!("visible" in body)) return json({ error: "Nada que actualizar" }, 400);
  const res = await db
    .prepare(
      `UPDATE events SET visible = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
    .bind(body.visible ? 1 : 0, id)
    .run();
  if (res.meta.changes === 0) return json({ error: "No existe" }, 404);
  return json({ ok: true });
};

// DELETE: only when the event has no tickets sold (paid history is immutable).
export const DELETE: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const db = (ctx.locals as any).runtime.env.DB;
  const env = (ctx.locals as any).runtime.env;
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return json({ error: "id inválido" }, 400);

  const sold = (await db
    .prepare("SELECT COUNT(*) AS n FROM tickets WHERE event_id = ?")
    .bind(id)
    .first()) as { n: number } | null;
  if (Number(sold?.n ?? 0) > 0)
    return json(
      { error: "El evento tiene entradas vendidas. Ocúltalo en vez de borrarlo." },
      409
    );

  const row = (await db
    .prepare("SELECT image_r2_key FROM events WHERE id = ?")
    .bind(id)
    .first()) as { image_r2_key: string | null } | null;
  if (row?.image_r2_key) {
    try {
      await env.MEDIA?.delete(row.image_r2_key);
    } catch {
      /* ignore */
    }
  }
  await db.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
  return json({ ok: true });
};
