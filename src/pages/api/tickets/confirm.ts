import type { APIRoute } from "astro";
import { confirmBoldOrder, CONFIRM_TARGETS, type ConfirmResult } from "@/lib/bold";
import { issueTicketsForOrder, getTicketOrderByBoldId } from "@/lib/tickets";
import { sendTicketEmail } from "@/lib/ticketEmailSend";

export const prerender = false;

const TICKET_ORDER_ID_RE = /^AFROIN-TIX-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    if (typeof orderId !== "string" || !TICKET_ORDER_ID_RE.test(orderId)) {
      return json({ error: "valid ticket orderId required" }, 400);
    }
    if (!env.BOLD_API_KEY) {
      console.error("ticket confirm: BOLD_API_KEY not configured");
      return json({ error: "Provider not configured" }, 500);
    }

    // Ask Bold only about orders that exist and are still pending: an unknown
    // id must not spend the merchant's voucher API quota, and a decided order
    // (completed by the webhook, free or courtesy) needs no query.
    const row = await env.DB.prepare(
      `SELECT status FROM ticket_orders WHERE bold_order_id = ?`
    )
      .bind(orderId)
      .first<{ status: string }>();
    if (!row) {
      return json({ status: "pending", providerStatus: null, order: null, event: null, tickets: [] }, 200);
    }

    let result: ConfirmResult = {
      donorStatus: row.status as ConfirmResult["donorStatus"],
      providerStatus: "",
      changed: false,
    };
    if (row.status === "pending") {
      // A Bold outage (fetch throws) must not fail the receipt: treat it as
      // "no answer yet"; D1 decides below.
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

    // Confirmation email, once per order (the webhook may send it first; the
    // claim decides), after the response: it never delays or fails the receipt.
    if (view.order?.status === "completed") {
      locals.runtime.ctx.waitUntil(
        sendTicketEmail(env, orderId, { origin: new URL(request.url).origin })
      );
    }

    // D1 is the source of truth: the status shown is the order's status after
    // this confirmation, so a paid buyer is never shown "pending" when the
    // webhook already completed the order, and "completed" is never shown
    // without the tickets that go with it.
    const status = view.order?.status ?? result.donorStatus;
    const completed = status === "completed";
    return json(
      {
        status,
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
      // The receipt carries the bearer access token: never cache it.
      "Cache-Control": "private, no-store",
    },
  });
}
