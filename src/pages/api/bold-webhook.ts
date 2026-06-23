import type { APIRoute } from "astro";
import {
  confirmBoldOrder,
  extractOrderId,
  confirmTargetForOrder,
} from "@/lib/bold";

export const prerender = false;

// Bold payment webhook.
//
// SECURITY NOTE: Bold's exact webhook signature scheme is not yet confirmed for
// this integration, so we do NOT trust the payload's reported status. Instead we
// use the webhook only as a trigger and re-query Bold server-side (payment-voucher)
// for the authoritative status. This makes a forged payload harmless: an attacker
// cannot mark a donation as completed without a real Bold transaction.
//
// TODO(bold-webhook-signature): once the signature header/scheme is confirmed from
// the Bold panel, add HMAC verification of the raw body and reject (401) invalid
// signatures before processing.
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  try {
    const raw = await request.text();
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
