// Event ticketing data layer. Like the store, the browser is UNTRUSTED: the
// checkout re-resolves the event from D1 by slug, re-prices server-side and
// enforces capacity. Tickets are only issued after Bold confirms the payment,
// idempotently (webhook + browser confirm can race).

import { generateOrderId } from "@/lib/bold";
import { BOLD_MIN_AMOUNT, CheckoutError } from "@/lib/orders";

const MAX_QTY = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (s: unknown, max = 200): string | null => {
  const v = typeof s === "string" ? s.trim() : "";
  return v ? v.slice(0, max) : null;
};

// Crockford base32 (no I/L/O/U) — unambiguous for manual door entry.
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 10;

/** Generate a random, manual-entry-friendly ticket code. */
export function generateTicketCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** Normalize a scanned/typed code: strip spaces & dashes, uppercase. */
export function normalizeCode(raw: unknown): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 20);
}

export interface EventRow {
  id: number;
  slug: string;
  name_es: string;
  name_en: string | null;
  name_fr: string | null;
  description_es: string | null;
  description_en: string | null;
  description_fr: string | null;
  venue: string | null;
  city: string | null;
  department?: string | null;
  country?: string | null;
  event_date: string;
  price: number;
  capacity: number;
  image_r2_key: string | null;
  visible: number;
}

export interface PublicEvent extends EventRow {
  sold: number;
  remaining: number;
  soldOut: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toPublic(row: EventRow & { sold?: number }): PublicEvent {
  const sold = Number(row.sold ?? 0);
  const remaining = Math.max(0, row.capacity - sold);
  return { ...row, sold, remaining, soldOut: remaining <= 0 };
}

/** Visible, not-yet-past events with their sold counts, soonest first. */
export async function getVisibleEvents(db: D1Database): Promise<PublicEvent[]> {
  const res = await db
    .prepare(
      `SELECT e.*, COALESCE(t.sold, 0) AS sold
       FROM events e
       LEFT JOIN (SELECT event_id, COUNT(*) AS sold FROM tickets GROUP BY event_id) t
         ON t.event_id = e.id
       WHERE e.visible = 1 AND e.event_date >= ?
       ORDER BY e.event_date ASC`
    )
    .bind(nowIso())
    .all<EventRow & { sold: number }>();
  return ((res.results as (EventRow & { sold: number })[]) || []).map(toPublic);
}

/** A single public event by slug. Returns null when missing, hidden or past. */
export async function getEventBySlug(
  db: D1Database,
  slug: string
): Promise<PublicEvent | null> {
  const row = await db
    .prepare(
      `SELECT e.*, COALESCE(t.sold, 0) AS sold
       FROM events e
       LEFT JOIN (SELECT event_id, COUNT(*) AS sold FROM tickets GROUP BY event_id) t
         ON t.event_id = e.id
       WHERE e.slug = ?`
    )
    .bind(slug)
    .first<(EventRow & { sold: number }) | null>();
  if (!row) return null;
  if (!row.visible || row.event_date < nowIso()) return null;
  return toPublic(row);
}

export interface TicketCheckoutInput {
  eventSlug?: string;
  quantity?: number | string;
  buyer?: { name?: string; email?: string; phone?: string | null };
}

export interface CreatedTicketOrder {
  id: number;
  orderId: string;
  amount: number;
  currency: string;
  quantity: number;
  eventName: string;
  accessToken: string;
  isFree?: boolean;
}

/**
 * Validate a ticket checkout and create a pending (or completed if free) ticket_orders row.
 * Throws CheckoutError (with an HTTP status) on any validation failure.
 */
export async function createPendingTicketOrder(
  db: D1Database,
  input: TicketCheckoutInput
): Promise<CreatedTicketOrder> {
  const slug = clean(input.eventSlug, 160);
  if (!slug) throw new CheckoutError("Evento inválido");

  const name = clean(input.buyer?.name, 100);
  const email = clean(input.buyer?.email, 120);
  if (!name) throw new CheckoutError("El nombre es obligatorio");
  if (!email || !EMAIL_RE.test(email))
    throw new CheckoutError("Se requiere un email válido");

  const qty = Math.trunc(Number(input.quantity));
  if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY)
    throw new CheckoutError("Cantidad inválida");

  const event = await db
    .prepare(
      `SELECT id, slug, name_es, price, capacity, visible, event_date
       FROM events WHERE slug = ?`
    )
    .bind(slug)
    .first<{
      id: number;
      slug: string;
      name_es: string;
      price: number;
      capacity: number;
      visible: number;
      event_date: string;
    } | null>();

  if (!event) throw new CheckoutError("El evento no existe");
  if (!event.visible || event.event_date < nowIso())
    throw new CheckoutError("El evento no está disponible");

  const unit = Math.trunc(Number(event.price));
  if (!Number.isFinite(unit) || unit < 0)
    throw new CheckoutError("Precio del evento inválido");

  // Capacity check. Note: a pending payment does NOT reserve seats, so a small
  // oversell window exists under concurrent purchases (accepted for v1).
  const soldRow = await db
    .prepare(`SELECT COUNT(*) AS sold FROM tickets WHERE event_id = ?`)
    .bind(event.id)
    .first<{ sold: number }>();
  const sold = Number(soldRow?.sold ?? 0);
  const remaining = event.capacity - sold;
  if (remaining <= 0) throw new CheckoutError("Entradas agotadas");
  if (qty > remaining)
    throw new CheckoutError(`Solo quedan ${remaining} entradas`);

  const isFree = unit === 0;
  const amount = unit * qty;
  if (!isFree && amount < BOLD_MIN_AMOUNT)
    throw new CheckoutError(`El total mínimo es ${BOLD_MIN_AMOUNT} COP`);

  const currency = "COP";
  const orderId = generateOrderId("ticket");
  const accessToken = crypto.randomUUID();

  const status = isFree ? "completed" : "pending";
  const provider = isFree ? "free" : "bold";
  const providerStatus = isFree ? "FREE" : null;
  const paidAt = isFree ? nowIso() : null;

  const res = await db
    .prepare(
      `INSERT INTO ticket_orders
        (bold_order_id, status, provider, provider_status, currency, amount,
         event_id, event_name, unit_price, quantity,
         buyer_name, buyer_email, buyer_phone, access_token,
         tickets_issued, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      orderId,
      status,
      provider,
      providerStatus,
      currency,
      amount,
      event.id,
      event.name_es,
      unit,
      qty,
      name,
      email,
      clean(input.buyer?.phone, 40),
      accessToken,
      isFree ? 1 : 0,
      paidAt
    )
    .run();

  const newOrderId = res.meta.last_row_id as number;

  if (isFree) {
    const codes: string[] = [];
    const stmt = db.prepare(
      `INSERT INTO tickets (ticket_order_id, event_id, code, status) VALUES (?, ?, ?, 'valid')`
    );
    const inserts = [];
    for (let i = 0; i < qty; i++) {
      const code = generateTicketCode();
      codes.push(code);
      inserts.push(stmt.bind(newOrderId, event.id, code));
    }
    await db.batch(inserts);
  }

  return {
    id: newOrderId,
    orderId,
    amount,
    currency,
    quantity: qty,
    eventName: event.name_es,
    accessToken,
    isFree,
  };
}

export interface CourtesyTicketInput {
  eventId?: number | string;
  quantity?: number | string;
  buyer?: { name?: string; email?: string; phone?: string | null };
}

export interface CreatedCourtesyOrder {
  id: number;
  orderId: string;
  eventName: string;
  quantity: number;
  accessToken: string;
  ticketCodes: string[];
}

/**
 * Issue complimentary / courtesy tickets directly (admin only).
 * Bypasses payment gateway, sets status='completed' and immediately emits ticket codes.
 */
export async function createCourtesyTicketOrder(
  db: D1Database,
  input: CourtesyTicketInput
): Promise<CreatedCourtesyOrder> {
  const eventId = Number(input.eventId);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    throw new CheckoutError("ID de evento inválido");
  }

  const name = clean(input.buyer?.name, 100);
  const email = clean(input.buyer?.email, 120);
  if (!name) throw new CheckoutError("El nombre es obligatorio");
  if (!email || !EMAIL_RE.test(email))
    throw new CheckoutError("Se requiere un email válido");

  const qty = Math.trunc(Number(input.quantity));
  if (!Number.isFinite(qty) || qty < 1 || qty > 50)
    throw new CheckoutError("Cantidad inválida (1 a 50)");

  const event = await db
    .prepare(`SELECT id, slug, name_es, capacity FROM events WHERE id = ?`)
    .bind(eventId)
    .first<{ id: number; slug: string; name_es: string; capacity: number } | null>();

  if (!event) throw new CheckoutError("El evento no existe");

  const soldRow = await db
    .prepare(`SELECT COUNT(*) AS sold FROM tickets WHERE event_id = ?`)
    .bind(event.id)
    .first<{ sold: number }>();
  const sold = Number(soldRow?.sold ?? 0);
  const remaining = event.capacity - sold;
  if (remaining < qty) {
    throw new CheckoutError(`Solo quedan ${Math.max(0, remaining)} cupos disponibles`);
  }

  const orderId = generateOrderId("ticket");
  const accessToken = crypto.randomUUID();

  const res = await db
    .prepare(
      `INSERT INTO ticket_orders
        (bold_order_id, status, provider, provider_status, currency, amount,
         event_id, event_name, unit_price, quantity,
         buyer_name, buyer_email, buyer_phone, access_token,
         tickets_issued, paid_at)
       VALUES (?, 'completed', 'courtesy', 'COMPLIMENTARY', 'COP', 0,
               ?, ?, 0, ?,
               ?, ?, ?, ?,
               1, CURRENT_TIMESTAMP)`
    )
    .bind(
      orderId,
      event.id,
      event.name_es,
      qty,
      name,
      email,
      clean(input.buyer?.phone, 40),
      accessToken
    )
    .run();

  const newOrderId = Number(res.meta.last_row_id);

  const codes: string[] = [];
  const stmt = db.prepare(
    `INSERT INTO tickets (ticket_order_id, event_id, code, status) VALUES (?, ?, ?, 'valid')`
  );
  const inserts = [];
  for (let i = 0; i < qty; i++) {
    const code = generateTicketCode();
    codes.push(code);
    inserts.push(stmt.bind(newOrderId, event.id, code));
  }
  await db.batch(inserts);

  return {
    id: newOrderId,
    orderId,
    eventName: event.name_es,
    quantity: qty,
    accessToken,
    ticketCodes: codes,
  };
}

interface TicketOrderRow {
  id: number;
  bold_order_id: string;
  status: string;
  amount: number;
  currency: string;
  event_id: number;
  event_name: string;
  unit_price: number;
  quantity: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  access_token: string;
  paid_at: string | null;
  created_at: string;
}

/**
 * Issue tickets for a completed order. Idempotent AND race-safe: the webhook and
 * the browser confirm can call this concurrently. We atomically "claim" the
 * order by flipping tickets_issued 0 -> 1 in a single UPDATE; only the caller
 * whose UPDATE actually changes a row proceeds to insert, so tickets can never
 * be double-issued. Does nothing unless the order is 'completed'.
 */
export async function issueTicketsForOrder(
  db: D1Database,
  boldOrderId: string
): Promise<{ issued: number; codes: string[] }> {
  const order = await db
    .prepare(
      `SELECT id, status, event_id, quantity FROM ticket_orders WHERE bold_order_id = ?`
    )
    .bind(boldOrderId)
    .first<{ id: number; status: string; event_id: number; quantity: number }>();

  if (!order || order.status !== "completed") return { issued: 0, codes: [] };

  // Atomic claim: only one concurrent caller wins the flip from 0 -> 1.
  const claim = await db
    .prepare(
      `UPDATE ticket_orders SET tickets_issued = 1
       WHERE id = ? AND status = 'completed' AND tickets_issued = 0`
    )
    .bind(order.id)
    .run();

  if (claim.meta.changes === 0) {
    // Someone else already claimed & issued — return the existing codes.
    const existing = await db
      .prepare(`SELECT code FROM tickets WHERE ticket_order_id = ? ORDER BY id`)
      .bind(order.id)
      .all<{ code: string }>();
    const existingCodes = (existing.results as { code: string }[]) || [];
    return { issued: 0, codes: existingCodes.map((r) => r.code) };
  }

  // Oversell log (still issue — the payment was approved).
  const cap = await db
    .prepare(
      `SELECT e.capacity AS capacity,
              (SELECT COUNT(*) FROM tickets WHERE event_id = e.id) AS sold
       FROM events e WHERE e.id = ?`
    )
    .bind(order.event_id)
    .first<{ capacity: number; sold: number }>();
  if (cap && Number(cap.sold) + order.quantity > Number(cap.capacity)) {
    console.error(
      `Ticket oversell: order ${boldOrderId} issues ${order.quantity} but event ${order.event_id} is at ${cap.sold}/${cap.capacity}`
    );
  }

  const codes: string[] = [];
  const stmt = db.prepare(
    `INSERT INTO tickets (ticket_order_id, event_id, code) VALUES (?, ?, ?)`
  );
  const inserts = [];
  for (let i = 0; i < order.quantity; i++) {
    const code = generateTicketCode();
    codes.push(code);
    inserts.push(stmt.bind(order.id, order.event_id, code));
  }
  await db.batch(inserts);

  return { issued: codes.length, codes };
}

export interface TicketOrderView {
  order: TicketOrderRow | null;
  event: EventRow | null;
  tickets: { code: string; status: string; checked_in_at: string | null }[];
}

async function loadTicketOrderView(
  db: D1Database,
  order: TicketOrderRow | null
): Promise<TicketOrderView> {
  if (!order) return { order: null, event: null, tickets: [] };
  const event = await db
    .prepare(`SELECT * FROM events WHERE id = ?`)
    .bind(order.event_id)
    .first<EventRow | null>();
  const tks = await db
    .prepare(
      `SELECT code, status, checked_in_at FROM tickets WHERE ticket_order_id = ? ORDER BY id`
    )
    .bind(order.id)
    .all<{ code: string; status: string; checked_in_at: string | null }>();
  return {
    order,
    event: event || null,
    tickets:
      (tks.results as {
        code: string;
        status: string;
        checked_in_at: string | null;
      }[]) || [],
  };
}

/** Full ticket-order view by permanent access token (bearer). */
export async function getTicketOrderByToken(
  db: D1Database,
  token: string
): Promise<TicketOrderView> {
  const order = await db
    .prepare(`SELECT * FROM ticket_orders WHERE access_token = ?`)
    .bind(token)
    .first<TicketOrderRow | null>();
  return loadTicketOrderView(db, order);
}

/** Full ticket-order view by Bold order id (used by the confirm receipt). */
export async function getTicketOrderByBoldId(
  db: D1Database,
  boldOrderId: string
): Promise<TicketOrderView> {
  const order = await db
    .prepare(`SELECT * FROM ticket_orders WHERE bold_order_id = ?`)
    .bind(boldOrderId)
    .first<TicketOrderRow | null>();
  return loadTicketOrderView(db, order);
}

export type CheckInResult =
  | { result: "ok"; attendee: string; eventName: string }
  | { result: "already"; attendee: string; eventName: string; checkedInAt: string }
  | { result: "not_found" }
  | { result: "not_paid" };

/**
 * Check in a ticket by code. Atomic against double-scan: the UPDATE is guarded
 * by status='valid' and we inspect meta.changes.
 */
export async function checkInTicket(
  db: D1Database,
  rawCode: string
): Promise<CheckInResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { result: "not_found" };

  const row = await db
    .prepare(
      `SELECT t.status AS ticket_status, t.checked_in_at AS checked_in_at,
              o.status AS order_status, o.buyer_name AS buyer_name,
              o.event_name AS event_name
       FROM tickets t
       JOIN ticket_orders o ON o.id = t.ticket_order_id
       WHERE t.code = ?`
    )
    .bind(code)
    .first<{
      ticket_status: string;
      checked_in_at: string | null;
      order_status: string;
      buyer_name: string;
      event_name: string;
    } | null>();

  if (!row) return { result: "not_found" };
  if (row.order_status !== "completed") return { result: "not_paid" };
  if (row.ticket_status === "checked_in") {
    return {
      result: "already",
      attendee: row.buyer_name,
      eventName: row.event_name,
      checkedInAt: row.checked_in_at || "",
    };
  }

  const upd = await db
    .prepare(
      `UPDATE tickets SET status = 'checked_in', checked_in_at = CURRENT_TIMESTAMP
       WHERE code = ? AND status = 'valid'`
    )
    .bind(code)
    .run();

  if (upd.meta.changes === 0) {
    // Lost the race — someone checked it in between our read and write.
    return {
      result: "already",
      attendee: row.buyer_name,
      eventName: row.event_name,
      checkedInAt: row.checked_in_at || "",
    };
  }

  return { result: "ok", attendee: row.buyer_name, eventName: row.event_name };
}

// --- Admin reads ---

export async function getEventsForAdmin(db: D1Database): Promise<any[]> {
  const res = await db
    .prepare(
      `SELECT e.*,
              COALESCE(t.sold, 0) AS sold,
              COALESCE(t.checked_in, 0) AS checked_in
       FROM events e
       LEFT JOIN (
         SELECT event_id,
                COUNT(*) AS sold,
                SUM(CASE WHEN status = 'checked_in' THEN 1 ELSE 0 END) AS checked_in
         FROM tickets GROUP BY event_id
       ) t ON t.event_id = e.id
       ORDER BY e.event_date DESC`
    )
    .all();
  return (res.results as any[]) || [];
}

export async function getTicketOrdersForAdmin(
  db: D1Database,
  eventId?: number
): Promise<any[]> {
  const base = `SELECT o.*,
       (SELECT COUNT(*) FROM tickets WHERE ticket_order_id = o.id) AS ticket_count,
       (SELECT COUNT(*) FROM tickets WHERE ticket_order_id = o.id AND status = 'checked_in') AS checked_in_count
     FROM ticket_orders o`;
  const stmt = eventId
    ? db.prepare(`${base} WHERE o.event_id = ? ORDER BY o.created_at DESC`).bind(eventId)
    : db.prepare(`${base} ORDER BY o.created_at DESC`);
  const res = await stmt.all();
  return (res.results as any[]) || [];
}

export async function getTicketOrderDetailForAdmin(
  db: D1Database,
  id: number
): Promise<any | null> {
  const order = await db
    .prepare(`SELECT * FROM ticket_orders WHERE id = ?`)
    .bind(id)
    .first();
  if (!order) return null;
  const tickets = await db
    .prepare(
      `SELECT id, code, status, checked_in_at FROM tickets WHERE ticket_order_id = ? ORDER BY id`
    )
    .bind(id)
    .all();
  return { ...order, tickets: (tickets.results as any[]) || [] };
}
