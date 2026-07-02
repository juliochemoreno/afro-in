import type { APIRoute } from "astro";
import { generateIntegritySignature } from "@/lib/bold";
import { CheckoutError } from "@/lib/orders";
import { createPendingTicketOrder } from "@/lib/tickets";

export const prerender = false;

const MAX_PAYLOAD_BYTES = 4096;
const BOLD_CURRENCY = "COP";

// Create a ticket order: validates + re-prices server-side, registers a pending
// ticket_orders row and returns what the browser needs to open the Bold checkout
// (including a server-side integrity signature). The secret key never leaves the
// server.
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  try {
    const raw = await request.text();
    if (raw.length > MAX_PAYLOAD_BYTES) {
      return json({ error: "Payload too large" }, 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (!env.BOLD_API_KEY || !env.BOLD_SECRET_KEY) {
      console.error("ticket checkout: Bold keys are not configured");
      return json({ error: "Payment provider not configured" }, 500);
    }

    let order;
    try {
      order = await createPendingTicketOrder(env.DB, body as any);
    } catch (e) {
      if (e instanceof CheckoutError) return json({ error: e.message }, e.status);
      throw e;
    }

    const amountStr = String(order.amount);
    const integritySignature = await generateIntegritySignature(
      order.orderId,
      amountStr,
      BOLD_CURRENCY,
      env.BOLD_SECRET_KEY
    );

    return json(
      {
        orderId: order.orderId,
        integritySignature,
        apiKey: env.BOLD_API_KEY,
        amount: amountStr,
        currency: BOLD_CURRENCY,
        quantity: order.quantity,
        eventName: order.eventName,
      },
      201
    );
  } catch (error) {
    console.error("Error creating ticket order:", error);
    return json({ error: "Internal server error" }, 500);
  }
};

export const OPTIONS: APIRoute = async () =>
  new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
