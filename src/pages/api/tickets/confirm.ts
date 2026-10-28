import type { APIRoute } from "astro";
import { confirmBoldOrder, CONFIRM_TARGETS, type ConfirmResult } from "@/lib/bold";
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
    let body: ConfirmRequest;
    try {
      body = (await request.json()) as ConfirmRequest;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const orderId = body?.orderId;
    if (!orderId || typeof orderId !== "string" || !orderId.startsWith("AFROIN-TIX-")) {
      return json({ error: "valid ticket orderId required" }, 400);
    }
    if (!env.BOLD_API_KEY) {
      console.error("ticket confirm: BOLD_API_KEY not configured");
      return json({ error: "Provider not configured" }, 500);
    }

    // A Bold outage (fetch throws) must not hide tickets of an order the
    // webhook already completed: treat it as "no answer yet" and read D1.
    let result: ConfirmResult;
    try {
      result = await confirmBoldOrder(
        env.DB,
        env.BOLD_API_KEY,
        orderId,
        CONFIRM_TARGETS.ticket
      );
    } catch (e) {
      console.error("ticket confirm: Bold voucher query failed", orderId, e);
      result = { donorStatus: "pending", providerStatus: "UNREACHABLE", changed: false };
    }

    // Issue tickets after confirmation regardless of `changed` or of what the
    // voucher said: the webhook may have completed the row first, or an older
    // version may have left it claimed without tickets. issueTicketsForOrder is
    // idempotent and does nothing unless the order is completed in D1.
    await issueTicketsForOrder(env.DB, orderId);

    let view = await getTicketOrderByBoldId(env.DB, orderId);
    // The webhook may have completed the order between our issuance call and
    // this read: issue (idempotent) and read again so the buyer gets tickets.
    if (view.order?.status === "completed" && view.tickets.length === 0) {
      await issueTicketsForOrder(env.DB, orderId);
      view = await getTicketOrderByBoldId(env.DB, orderId);
    }

    // D1 is the source of truth once an order is completed (by the webhook, or
    // as a free/courtesy order): a failed or late voucher query must not show a
    // paid buyer "pending" and hide their tickets.
    const completed =
      view.order?.status === "completed" || result.donorStatus === "completed";
    return json(
      {
        status: completed ? "completed" : result.donorStatus,
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
