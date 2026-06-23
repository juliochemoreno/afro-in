import type { APIRoute } from "astro";
import { generateIntegritySignature } from "@/lib/bold";
import { createPendingOrder, CheckoutError } from "@/lib/orders";

export const prerender = false;

const MAX_PAYLOAD_BYTES = 20_480; // ~20KB (cart + address)
const BOLD_CURRENCY = "COP";

// Create a store order: validates the cart server-side (re-pricing from D1),
// registers a pending order and returns what the browser needs to open the Bold
// checkout (including a server-side integrity signature). The secret key never
// leaves the server.
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
      console.error("store checkout: Bold keys are not configured");
      return json({ error: "Payment provider not configured" }, 500);
    }

    let order;
    try {
      order = await createPendingOrder(env.DB, body as any);
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
        subtotal: order.subtotal,
        itemCount: order.itemCount,
      },
      201
    );
  } catch (error) {
    console.error("Error creating store order:", error);
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
