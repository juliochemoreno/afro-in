import type { APIRoute } from "astro";
import { generateIntegritySignature } from "@/lib/bold";
import { CheckoutError } from "@/lib/orders";
import { PriceChangedError, createPendingTicketOrder } from "@/lib/tickets";
import { sendTicketEmail } from "@/lib/ticketEmailSend";

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

    const paymentsEnabled = Boolean(env.BOLD_API_KEY && env.BOLD_SECRET_KEY);
    let order;
    try {
      order = await createPendingTicketOrder(env.DB, body as any, { paymentsEnabled });
    } catch (e) {
      // The stage moved on since the buyer loaded the page: tell the form the
      // new price so the buyer accepts it before paying.
      if (e instanceof PriceChangedError) {
        return json(
          { error: e.message, code: "price_changed", unitPrice: e.unitPrice },
          e.status
        );
      }
      if (e instanceof CheckoutError) {
        if (e.status >= 500) console.error("ticket checkout:", e.message);
        return json({ error: e.message, code: e.code, ...e.params }, e.status);
      }
      throw e;
    }

    if (order.isFree || order.amount === 0) {
      // A free reservation is completed with its tickets already: email them
      // after the response.
      locals.runtime.ctx?.waitUntil(
        sendTicketEmail(env, order.orderId, { origin: new URL(request.url).origin })
      );
      return json(
        {
          free: true,
          orderId: order.orderId,
          accessToken: order.accessToken,
          quantity: order.quantity,
          eventName: order.eventName,
        },
        201
      );
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
