import type { APIRoute } from "astro";
import { confirmBoldOrder, confirmTargetForOrder, orderKindFromId } from "@/lib/bold";

export const prerender = false;

interface ConfirmRequest {
  orderId?: string;
}

// Backup confirmation for Bold payments, called from /gracias when the donor
// returns from the checkout. Queries Bold server-side (identity key stays on the
// server) and updates the row idempotently — same UPDATE path as the webhook.
// The table comes from the order-id prefix through the closed CONFIRM_TARGETS
// list (donations -> donors, store orders -> orders). Ticket orders must use
// /api/tickets/confirm, which also issues the tickets.
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  try {
    const { orderId } = (await request.json()) as ConfirmRequest;

    if (!orderId || typeof orderId !== "string") {
      return json({ error: "orderId required" }, 400);
    }
    if (orderKindFromId(orderId) === "ticket") {
      return json({ error: "ticket orders are confirmed at /api/tickets/confirm" }, 400);
    }

    if (!env.BOLD_API_KEY) {
      console.error("bold-confirmar: BOLD_API_KEY not configured");
      return json({ error: "Provider not configured" }, 500);
    }

    const result = await confirmBoldOrder(
      env.DB,
      env.BOLD_API_KEY,
      orderId,
      confirmTargetForOrder(orderId)
    );

    // Total completed donors (drives the live counter on /gracias).
    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM donors WHERE status = 'completed'`
    ).first<{ total: number }>();

    return json(
      {
        status: result.donorStatus,
        providerStatus: result.providerStatus,
        totalDonors: countResult?.total || 0,
      },
      200
    );
  } catch (error) {
    console.error("Error confirming Bold order:", error);
    return json({ error: "Internal server error" }, 500);
  }
};

// CORS preflight
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
