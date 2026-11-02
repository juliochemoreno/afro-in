import type { APIRoute } from "astro";
import { requireAdmin, adminUnauthorized } from "@/lib/adminAuth";
import { sendTicketEmail } from "@/lib/ticketEmailSend";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// POST: send (or resend) a completed order's ticket email now, whatever its
// email status (old orders, failed sends, a buyer who lost it).
export const POST: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const env = ctx.locals.runtime.env;
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: "id inválido" }, 400);

  const order = await env.DB.prepare(
    `SELECT bold_order_id, status,
            (SELECT COUNT(*) FROM tickets WHERE ticket_order_id = o.id) AS ticket_count
     FROM ticket_orders o WHERE id = ?`
  )
    .bind(id)
    .first<{ bold_order_id: string; status: string; ticket_count: number }>();
  if (!order) return json({ error: "No existe" }, 404);
  if (order.status !== "completed" || !Number(order.ticket_count))
    return json({ error: "La compra no está completada" }, 409);

  const result = await sendTicketEmail(env, order.bold_order_id, {
    origin: ctx.url.origin,
    force: true,
  });
  const row = await env.DB.prepare(
    `SELECT email_status, email_sent_at, email_error FROM ticket_orders WHERE id = ?`
  )
    .bind(id)
    .first();
  if (result.status === "no_key")
    return json({ ...result, error: "El envío de correos no está configurado", order: row }, 503);
  return json({ ...result, order: row }, result.status === "sent" ? 200 : 502);
};
