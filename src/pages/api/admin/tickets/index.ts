import type { APIRoute } from "astro";
import { requireAdmin, adminUnauthorized } from "@/lib/adminAuth";
import { getTicketOrdersForAdmin } from "@/lib/tickets";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// GET: list ticket orders (admin). Optional ?eventId= filter.
export const GET: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const db = (ctx.locals as any).runtime.env.DB;
  const eventIdParam = ctx.url.searchParams.get("eventId");
  const eventId = eventIdParam ? Number(eventIdParam) : undefined;
  const orders = await getTicketOrdersForAdmin(
    db,
    Number.isFinite(eventId as number) ? eventId : undefined
  );
  return json({ orders });
};
