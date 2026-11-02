import type { APIRoute } from "astro";
import { requireAdmin, adminUnauthorized } from "@/lib/adminAuth";
import { CheckoutError } from "@/lib/orders";
import { createCourtesyTicketOrder } from "@/lib/tickets";
import { sendTicketEmail } from "@/lib/ticketEmailSend";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const env = ctx.locals.runtime.env;
  const db = env.DB;

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  try {
    const result = await createCourtesyTicketOrder(db, body);
    // The guest gets the same email as a buyer, after the response.
    ctx.locals.runtime.ctx.waitUntil(
      sendTicketEmail(env, result.orderId, { origin: ctx.url.origin })
    );
    return json(result, 201);
  } catch (e: any) {
    if (e instanceof CheckoutError) {
      return json({ error: e.message }, e.status || 400);
    }
    console.error("Error creating courtesy tickets:", e);
    return json({ error: "Error interno al crear cortesía" }, 500);
  }
};
