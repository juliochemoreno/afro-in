import type { APIRoute } from "astro";
import { generateOrderId, generateIntegritySignature } from "@/lib/bold";

export const prerender = false;

const BOLD_CURRENCY = "COP";
const BOLD_MIN_AMOUNT = 1000; // Bold minimum: $1.000 COP
const MAX_PAYLOAD_BYTES = 10_240; // ~10KB

interface BoldSignRequest {
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  amount?: number | string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// API to create a Bold order: registers a pending donor and returns the
// data needed to open the Bold checkout (including a server-side signature).
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  try {
    // Reject oversized payloads early.
    const raw = await request.text();
    if (raw.length > MAX_PAYLOAD_BYTES) {
      return json({ error: "Payload too large" }, 413);
    }

    let data: BoldSignRequest;
    try {
      data = JSON.parse(raw) as BoldSignRequest;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const name = (data.name || "").trim();
    const email = (data.email || "").trim();
    const amount = Math.trunc(Number(data.amount));

    // Validation
    if (!name || name.length > 100) {
      return json({ error: "Name is required (max 100 chars)" }, 400);
    }
    if (!email || !EMAIL_RE.test(email)) {
      return json({ error: "A valid email is required" }, 400);
    }
    if (!Number.isFinite(amount) || amount < BOLD_MIN_AMOUNT) {
      return json(
        { error: `Amount must be an integer >= ${BOLD_MIN_AMOUNT} COP` },
        400
      );
    }

    if (!env.BOLD_API_KEY || !env.BOLD_SECRET_KEY) {
      console.error("Bold keys are not configured");
      return json({ error: "Payment provider not configured" }, 500);
    }

    // Amount as the exact string used both to sign and to open the checkout.
    const amountStr = String(amount);
    const orderId = generateOrderId();
    const integritySignature = await generateIntegritySignature(
      orderId,
      amountStr,
      BOLD_CURRENCY,
      env.BOLD_SECRET_KEY
    );

    // Register the donor as pending (Bold provider, COP).
    const result = await env.DB.prepare(
      `INSERT INTO donors (name, email, phone, country, amount, status, provider, currency, bold_order_id)
       VALUES (?, ?, ?, ?, ?, 'pending', 'bold', 'COP', ?)`
    )
      .bind(
        name,
        email,
        data.phone?.trim() || null,
        data.country?.trim() || null,
        amount,
        orderId
      )
      .run();

    // NOTE: BOLD_SECRET_KEY is never returned. apiKey is the public identity key.
    return json(
      {
        orderId,
        integritySignature,
        apiKey: env.BOLD_API_KEY,
        amount: amountStr,
        currency: BOLD_CURRENCY,
        donorId: result.meta.last_row_id,
      },
      201
    );
  } catch (error) {
    console.error("Error creating Bold order:", error);
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
