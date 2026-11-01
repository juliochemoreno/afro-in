import type { APIRoute } from "astro";
import { requireAdmin, adminUnauthorized } from "@/lib/adminAuth";
import {
  EVENT_COLUMNS,
  eventValues,
  parseStages,
  stageSyncStatements,
  validateEventInput,
} from "@/lib/eventAdmin";

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

  // Stages first: with stages the event price becomes the first stage's price.
  // No `stages` key leaves the event's stages as they are.
  const parsed = parseStages(body);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const err = validateEventInput(body);
  if (err) return json({ error: err }, 400);

  let stageStatements: D1PreparedStatement[] = [];
  let removedNames: string[] = [];
  if (parsed.stages) {
    const exists = await db.prepare("SELECT id FROM events WHERE id = ?").bind(id).first();
    if (!exists) return json({ error: "No existe" }, 404);
    const current = await db
      .prepare(
        `SELECT s.id, s.name_es,
                EXISTS (SELECT 1 FROM ticket_orders o WHERE o.stage_id = s.id) AS has_orders
         FROM event_price_stages s WHERE s.event_id = ?`
      )
      .bind(id)
      .all();
    const rows = (current.results || []) as { id: number; name_es: string; has_orders: number }[];
    const known = new Set(rows.map((r) => Number(r.id)));
    if (parsed.stages.some((s) => s.id != null && !known.has(s.id)))
      return json({ error: "Una etapa no pertenece a este evento. Recarga la página." }, 400);
    const kept = new Set(parsed.stages.map((s) => s.id));
    const removed = rows.filter((r) => !kept.has(Number(r.id)));
    const locked = removed.find((r) => Number(r.has_orders));
    if (locked)
      return json(
        { error: `La etapa «${locked.name_es}» tiene órdenes; no se puede borrar.` },
        409
      );
    removedNames = removed.map((r) => r.name_es);
    stageStatements = stageSyncStatements(
      db,
      id,
      parsed.stages,
      removed.map((r) => Number(r.id))
    );
  }

  const setClause = EVENT_COLUMNS.map((c) => `${c} = ?`).join(", ");
  try {
    // Event and its stages in one batch (a single transaction).
    const results = await db.batch([
      db
        .prepare(
          `UPDATE events SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        )
        .bind(...eventValues(body), id),
      ...stageStatements,
    ]);
    if (results[0].meta.changes === 0) return json({ error: "No existe" }, 404);
    // Deletes come right after the event update; one that changed nothing
    // means an order arrived for that stage meanwhile, so it was kept.
    const kept = removedNames.filter((_, i) => results[1 + i].meta.changes === 0);
    if (kept.length > 0)
      return json(
        {
          error: `La etapa «${kept[0]}» recibió una orden mientras guardabas y no se borró. Los demás cambios se guardaron; recarga la página.`,
        },
        409
      );
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

  if (!body || typeof body !== "object" || !("visible" in body))
    return json({ error: "Nada que actualizar" }, 400);
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

  // Any ticket order (paid, pending or rejected) keeps the event: orders
  // reference it, and paid history must not cascade away.
  const used = (await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM tickets WHERE event_id = ?) +
              (SELECT COUNT(*) FROM ticket_orders WHERE event_id = ?) AS n`
    )
    .bind(id, id)
    .first()) as { n: number } | null;
  if (Number(used?.n ?? 0) > 0)
    return json(
      { error: "El evento tiene entradas u órdenes. Ocúltalo en vez de borrarlo." },
      409
    );

  const row = (await db
    .prepare("SELECT image_r2_key FROM events WHERE id = ?")
    .bind(id)
    .first()) as { image_r2_key: string | null } | null;
  if (!row) return json({ error: "No existe" }, 404);

  try {
    await db.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
  } catch (e) {
    console.error("delete event error:", e);
    return json({ error: "No se pudo borrar el evento" }, 500);
  }

  // Remove the image only after the row is gone, and only event images.
  if (row.image_r2_key?.startsWith("events/")) {
    try {
      await env.MEDIA?.delete(row.image_r2_key);
    } catch {
      /* ignore */
    }
  }
  return json({ ok: true });
};
