import type { APIRoute } from "astro";
import { confirmBoldOrder, CONFIRM_TARGETS } from "@/lib/bold";
import { issueTicketsForOrder, getTicketOrderByBoldId } from "@/lib/tickets";

export const prerender = false;

interface ConfirmRequest {
  orderId?: string;
}

// Backup confirmation for ticket payments, called from the success page when the
// customer returns from the Bold checkout. Queries Bold server-side, updates the
// order idempotently (same path as the webhook) and issues tickets. Returns a
// receipt with the tickets when the payment is completed.
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  try {
    const { orderId } = (await request.json()) as ConfirmRequest;
    if (!orderId || typeof orderId !== "string" || !orderId.startsWith("AFROIN-TIX-")) {
      return json({ error: "valid ticket orderId required" }, 400);
    }
    if (!env.BOLD_API_KEY) {
      console.error("ticket confirm: BOLD_API_KEY not configured");
      return json({ error: "Provider not configured" }, 500);
    }

    const result = await confirmBoldOrder(
      env.DB,
      env.BOLD_API_KEY,
      orderId,
      CONFIRM_TARGETS.ticket
    );

    // Issue tickets after confirmation regardless of `changed`: the webhook may
    // have flipped the row first. issueTicketsForOrder is idempotent.
    if (result.donorStatus === "completed") {
      await issueTicketsForOrder(env.DB, orderId);
    }

    const view = await getTicketOrderByBoldId(env.DB, orderId);

    const completed = result.donorStatus === "completed";
    return json(
      {
        status: result.donorStatus,
        providerStatus: result.providerStatus,
        order: view.order
          ? {
              id: view.order.id,
              event_name: view.order.event_name,
              quantity: view.order.quantity,
              amount: view.order.amount,
              currency: view.order.currency,
              access_token: view.order.access_token,
              paid_at: view.order.paid_at,
            }
          : null,
        event: view.event,
        tickets: completed ? view.tickets : [],
      },
      200
    );
  } catch (error) {
    console.error("Error confirming ticket order:", error);
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
