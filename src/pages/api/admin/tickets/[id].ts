import type { APIRoute } from "astro";
import { requireAdmin, adminUnauthorized } from "@/lib/adminAuth";
import { getTicketOrderDetailForAdmin } from "@/lib/tickets";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// GET: a ticket order + its individual tickets (admin detail dialog).
export const GET: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const db = (ctx.locals as any).runtime.env.DB;
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return json({ error: "id inválido" }, 400);
  const order = await getTicketOrderDetailForAdmin(db, id);
  if (!order) return json({ error: "No existe" }, 404);
  return json({ order });
};
