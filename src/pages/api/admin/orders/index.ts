import type { APIRoute } from "astro";
import { requireAdmin, adminUnauthorized } from "@/lib/adminAuth";
import { getOrders } from "@/lib/orders";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// GET: list all store orders (admin).
export const GET: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const db = (ctx.locals as any).runtime.env.DB;
  const orders = await getOrders(db);
  return json({ orders });
};
