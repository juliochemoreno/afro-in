import type { APIRoute } from "astro";
import {
  confirmBoldOrder,
  extractOrderId,
  confirmTargetForOrder,
  orderKindFromId,
  verifyWebhookSignature,
} from "@/lib/bold";
import { issueTicketsForOrder } from "@/lib/tickets";

export const prerender = false;

// Bold payment webhook.
//
// SECURITY NOTE: We now verify the Bold webhook HMAC signature if the secret key
// is configured. We also re-query Bold server-side (payment-voucher) for the
// authoritative status as a defense-in-depth measure. This makes a forged payload
// harmless: an attacker cannot mark a donation as completed without a real Bold transaction.
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  try {
    const raw = await request.text();
    const signature = request.headers.get("bold-signature");

    if (env.BOLD_SECRET_KEY && signature) {
      const isValid = await verifyWebhookSignature(raw, signature, env.BOLD_SECRET_KEY);
      if (!isValid) {
        console.error("Bold webhook: invalid HMAC signature");
        return json({ error: "Invalid signature" }, 401);
      }
    } else if (env.BOLD_SECRET_KEY && !signature) {
      console.warn("Bold webhook: missing signature header, proceeding without verification");
    }

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
    // not gated on `changed` (the browser confirm may have flipped the row
    // first). Failure here must not fail the webhook — Bold would retry and the
    // idempotent issuance re-runs harmlessly.
    if (
      orderKindFromId(orderId) === "ticket" &&
      result.donorStatus === "completed"
    ) {
      try {
        await issueTicketsForOrder(env.DB, orderId);
      } catch (e) {
        console.error("Bold webhook: ticket issuance failed", orderId, e);
      }
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
