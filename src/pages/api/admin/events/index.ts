import type { APIRoute } from "astro";
import { requireAdmin, adminUnauthorized } from "@/lib/adminAuth";
import { getEventsForAdmin } from "@/lib/tickets";
import { EVENT_COLUMNS, eventValues, validateEventInput } from "@/lib/eventAdmin";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// GET: all events (including hidden/past) with sold + checked-in counts.
export const GET: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const db = (ctx.locals as any).runtime.env.DB;
  const events = await getEventsForAdmin(db);
  return json({ events });
};

// POST: create an event.
export const POST: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const db = (ctx.locals as any).runtime.env.DB;

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const err = validateEventInput(body);
  if (err) return json({ error: err }, 400);

  const placeholders = EVENT_COLUMNS.map(() => "?").join(", ");
  try {
    const res = await db
      .prepare(
        `INSERT INTO events (${EVENT_COLUMNS.join(", ")}, updated_at)
         VALUES (${placeholders}, CURRENT_TIMESTAMP)`
      )
      .bind(...eventValues(body))
      .run();
    return json({ id: Number(res.meta.last_row_id) }, 201);
  } catch (e: any) {
    if (String(e?.message || e).includes("UNIQUE"))
      return json({ error: "El slug ya existe" }, 409);
    console.error("create event error:", e);
    return json({ error: "No se pudo crear el evento" }, 500);
  }
};
