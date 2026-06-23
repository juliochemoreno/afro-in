import type { APIRoute } from "astro";
import { confirmBoldOrder, CONFIRM_TARGETS } from "@/lib/bold";

export const prerender = false;

interface ConfirmRequest {
  orderId?: string;
}

// Backup confirmation for store payments, called from /pedido when the customer
// returns from the Bold checkout. Queries Bold server-side (identity key stays
// on the server) and updates the order idempotently — same path as the webhook.
// Returns a small receipt so the page can render the order summary.
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  try {
    const { orderId } = (await request.json()) as ConfirmRequest;
    if (!orderId || typeof orderId !== "string") {
      return json({ error: "orderId required" }, 400);
    }
    if (!env.BOLD_API_KEY) {
      console.error("store confirm: BOLD_API_KEY not configured");
      return json({ error: "Provider not configured" }, 500);
    }

    const result = await confirmBoldOrder(
      env.DB,
      env.BOLD_API_KEY,
      orderId,
      CONFIRM_TARGETS.order
    );

    const order = await env.DB.prepare(
      `SELECT id, bold_order_id, status, amount, currency, item_count,
              customer_name, customer_email, created_at, paid_at
       FROM orders WHERE bold_order_id = ?`
    )
      .bind(orderId)
      .first<{ id: number } & Record<string, unknown>>();

    let items: unknown[] = [];
    if (order) {
      const r = await env.DB.prepare(
        `SELECT name, size, color, unit_price, quantity, line_total
         FROM order_items WHERE order_id = ? ORDER BY id`
      )
        .bind(order.id)
        .all();
      items = (r.results as unknown[]) || [];
    }

    return json(
      {
        status: result.donorStatus,
        providerStatus: result.providerStatus,
        order: order || null,
        items,
      },
      200
    );
  } catch (error) {
    console.error("Error confirming store order:", error);
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
