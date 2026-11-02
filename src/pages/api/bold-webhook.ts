import type { APIRoute } from "astro";
import {
  confirmBoldOrder,
  extractOrderId,
  confirmTargetForOrder,
  orderKindFromId,
} from "@/lib/bold";
import { issueTicketsForOrder } from "@/lib/tickets";
import { sendTicketEmail } from "@/lib/ticketEmailSend";

export const prerender = false;

// Bold payment webhook.
//
// SECURITY NOTE: we do NOT trust the payload's reported status. The webhook is
// only a trigger: we re-query Bold server-side (payment-voucher) for the
// authoritative status. This makes a forged payload harmless: an attacker
// cannot mark a donation, order or ticket purchase as paid without a real Bold
// transaction.
//
// TODO(bold-webhook-signature): verify `x-bold-signature` (documented at
// https://www.developers.bold.co/webhook: HMAC-SHA256, hex, over the Base64 of
// the raw body; key = the secret key in production, the EMPTY string in test
// mode) and reject (401) invalid ones. Confirm the scheme against a real test
// webhook first: a wrong key would reject legitimate notifications.
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  try {
    const raw = await request.text();
    // Observability for the TODO above: does Bold send the signature header?
    console.info(
      "Bold webhook: x-bold-signature present:",
      request.headers.has("x-bold-signature")
    );

    const orderId = extractOrderId(raw);

    if (!orderId) {
      console.error("Bold webhook: could not extract order id from payload");
      // 200 so Bold does not retry a payload we will never be able to match.
      return json({ received: true, matched: false }, 200);
    }

    if (!env.BOLD_API_KEY) {
      console.error("Bold webhook: BOLD_API_KEY not configured");
      return json({ error: "Provider not configured" }, 500);
    }

    // Re-query Bold for the real status and update idempotently. Route to the
    // right table (donors vs orders) by the order id prefix.
    const result = await confirmBoldOrder(
      env.DB,
      env.BOLD_API_KEY,
      orderId,
      confirmTargetForOrder(orderId)
    );

    // Ticket orders issue their individual tickets once paid. Idempotent, and
    // not gated on `changed` or on this voucher answer (the browser confirm may
    // have completed the row first); it does nothing unless the order is
    // completed in D1. Failure here must not fail the webhook: the next confirm
    // or retry re-runs the idempotent issuance.
    if (orderKindFromId(orderId) === "ticket") {
      try {
        await issueTicketsForOrder(env.DB, orderId);
      } catch (e) {
        console.error("Bold webhook: ticket issuance failed", orderId, e);
      }
      // Confirmation email, once per order (the claim decides), after the
      // response: it never delays or fails the webhook.
      locals.runtime.ctx.waitUntil(
        sendTicketEmail(env, orderId, { origin: new URL(request.url).origin })
      );
    }

    return json(
      {
        received: true,
        orderId,
        status: result.donorStatus,
        changed: result.changed,
      },
      200
    );
  } catch (error) {
    console.error("Error processing Bold webhook:", error);
    // 500 lets Bold retry transient failures.
    return json({ error: "Internal server error" }, 500);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
