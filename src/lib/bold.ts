// Bold.co payment helpers — server-side only.
// The integrity signature uses the SECRET key, so these helpers must never run
// in the browser. They rely on Web Crypto (available in Cloudflare Workers).

export const BOLD_CHECKOUT_SDK =
  "https://checkout.bold.co/library/boldPaymentButton.js";
export const BOLD_VOUCHER_API =
  "https://payments.api.bold.co/v2/payment-voucher";

// Internal donor status derived from a Bold transaction status.
export type DonorStatus = "completed" | "rejected" | "pending";

// A Bold order id encodes which domain it belongs to so the single shared
// webhook can route confirmations to the right table by prefix:
//   donation -> AFROIN-<uuid>        (legacy, no infix — kept as-is)
//   order    -> AFROIN-ORD-<uuid>
//   ticket   -> AFROIN-TIX-<uuid>
export type OrderKind = "donation" | "order" | "ticket";

const KIND_INFIX: Record<Exclude<OrderKind, "donation">, string> = {
  order: "ORD",
  ticket: "TIX",
};

/**
 * Generate a unique order id for a Bold checkout, tagged by domain so the
 * webhook can route by prefix. Uses crypto.randomUUID (Workers runtime).
 */
export function generateOrderId(kind: OrderKind = "donation"): string {
  const infix = kind === "donation" ? "" : `${KIND_INFIX[kind]}-`;
  return `AFROIN-${infix}${crypto.randomUUID()}`;
}

/** Infer the domain of an order id from its prefix. */
export function orderKindFromId(orderId: string): OrderKind {
  if (orderId.startsWith("AFROIN-ORD-")) return "order";
  if (orderId.startsWith("AFROIN-TIX-")) return "ticket";
  return "donation";
}

/**
 * Compute Bold's integrity signature.
 * Bold concatenates "{orderId}{amount}{currency}{secretKey}" and hashes it with
 * SHA-256 (hex, lowercase). The `amount` MUST be the exact string sent to the
 * checkout (integer, no decimals) or the signature will not match.
 */
export async function generateIntegritySignature(
  orderId: string,
  amount: string,
  currency: string,
  secretKey: string
): Promise<string> {
  const chain = `${orderId}${amount}${currency}${secretKey}`;
  const encoded = new TextEncoder().encode(chain);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Map a raw Bold transaction status to our internal donor status.
 * - APPROVED                       -> completed
 * - REJECTED / FAILED / VOIDED     -> rejected
 * - PROCESSING / PENDING / unknown -> pending (not yet final)
 */
export function mapBoldStatus(status: string | undefined | null): DonorStatus {
  switch ((status || "").toUpperCase()) {
    case "APPROVED":
      return "completed";
    case "REJECTED":
    case "FAILED":
    case "VOIDED":
      return "rejected";
    default:
      // PROCESSING, PENDING, NO_TRANSACTION_FOUND, empty, unknown
      return "pending";
  }
}

export interface BoldVoucher {
  status: string;
  transactionId: string | null;
}

/**
 * Query Bold for the real status of an order. This is the trustworthy source
 * of truth (server-to-server with the identity key), independent of any
 * browser redirect or webhook payload.
 * Returns null when Bold has no transaction for the order yet.
 */
export async function fetchBoldVoucher(
  orderId: string,
  apiKey: string
): Promise<BoldVoucher | null> {
  const res = await fetch(`${BOLD_VOUCHER_API}/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: { Authorization: `x-api-key ${apiKey}` },
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json().catch(() => null)) as Record<string, any> | null;
  if (!data) return null;

  // Defensive read: the voucher shape may nest the payload under `data`.
  const payload = (data.data ?? data) as Record<string, any>;
  const status: string =
    payload.status ?? payload.payment_status ?? payload.transaction_status ?? "";
  const transactionId: string | null =
    payload.transaction_id ??
    payload.payment_id ??
    payload.id ??
    null;

  if (!status || status.toUpperCase() === "NO_TRANSACTION_FOUND") {
    return { status: "NO_TRANSACTION_FOUND", transactionId: null };
  }

  return { status, transactionId };
}

export interface ConfirmResult {
  donorStatus: DonorStatus;
  providerStatus: string;
  changed: boolean;
}

// Which table a confirmation writes to. The table + timestamp column names come
// ONLY from this hardcoded whitelist (never from user input), so building the
// UPDATE by string interpolation is safe. Both tables share the same status
// vocabulary ('pending' | 'completed' | 'rejected') and the columns
// status / provider_status / transaction_id / bold_order_id.
export interface ConfirmTarget {
  table: "donors" | "orders";
  timestampColumn: "completed_at" | "paid_at";
}

export const CONFIRM_TARGETS: Record<"donation" | "order", ConfirmTarget> = {
  donation: { table: "donors", timestampColumn: "completed_at" },
  order: { table: "orders", timestampColumn: "paid_at" },
};

/** Pick the confirmation target for an order id by its prefix. */
export function confirmTargetForOrder(orderId: string): ConfirmTarget {
  return orderKindFromId(orderId) === "order"
    ? CONFIRM_TARGETS.order
    : CONFIRM_TARGETS.donation;
}

/**
 * Confirm a Bold order by querying the voucher and updating the target row
 * idempotently. Only promotes rows still in 'pending' state, so duplicate
 * webhook/redirect calls cannot double-count. Shared by the webhook and the
 * /gracias and /pedido fallback endpoints. Defaults to the donors table for
 * backward compatibility.
 */
export async function confirmBoldOrder(
  db: D1Database,
  apiKey: string,
  orderId: string,
  target: ConfirmTarget = CONFIRM_TARGETS.donation
): Promise<ConfirmResult> {
  const voucher = await fetchBoldVoucher(orderId, apiKey);
  const providerStatus = voucher?.status ?? "NO_TRANSACTION_FOUND";
  const donorStatus = mapBoldStatus(providerStatus);

  // Nothing to persist until the transaction reaches a final state.
  if (donorStatus === "pending") {
    return { donorStatus, providerStatus, changed: false };
  }

  const ts = target.timestampColumn;
  const tsExpr = donorStatus === "completed" ? "CURRENT_TIMESTAMP" : ts;

  const result = await db
    .prepare(
      `UPDATE ${target.table}
       SET status = ?, provider_status = ?, transaction_id = ?, ${ts} = ${tsExpr}
       WHERE bold_order_id = ? AND status = 'pending'`
    )
    .bind(donorStatus, providerStatus, voucher?.transactionId ?? null, orderId)
    .run();

  return {
    donorStatus,
    providerStatus,
    changed: result.meta.changes > 0,
  };
}

/**
 * Extract our order id from an arbitrary Bold webhook payload. Our order ids
 * carry the "AFROIN-" prefix (optionally with an ORD-/TIX- domain infix), so we
 * can locate them regardless of the exact (and undocumented) webhook envelope.
 */
export function extractOrderId(rawBody: string): string | null {
  const match = rawBody.match(/AFROIN-(?:ORD-|TIX-)?[0-9a-fA-F-]{36}/);
  return match ? match[0] : null;
}
