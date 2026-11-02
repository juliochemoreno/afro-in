// Event ticketing data layer. Like the store, the browser is UNTRUSTED: the
// checkout re-resolves the event from D1 by slug, re-prices server-side and
// enforces capacity. Tickets are only issued after Bold confirms the payment,
// idempotently (webhook + browser confirm can race).

import { generateOrderId } from "@/lib/bold";
import { BOLD_MIN_AMOUNT, CheckoutError } from "@/lib/orders";
import { normalizeStoredPhone } from "@/lib/checkoutFields";
import { doorDay, doorDayIndex, isMultiDay } from "@/lib/doorDay";
import {
  HOLD_MINUTES,
  bogotaToday,
  isEventOver,
  nowBogotaWallClock,
  resolveSale,
  stageStatuses,
  type Sale,
  type StageView,
  type StageWithSales,
} from "@/lib/ticketStages";

const MAX_QTY = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (s: unknown, max = 200): string | null => {
  const v = typeof s === "string" ? s.trim() : "";
  return v ? v.slice(0, max) : null;
};

export type OrderLocale = "es" | "en" | "fr";

/** The buyer's language for the order email; anything unknown is Spanish. */
export function orderLocale(raw: unknown): OrderLocale {
  return raw === "en" || raw === "fr" ? raw : "es";
}

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
  end_date?: string | null; // last day (YYYY-MM-DD) of a multi-day event
  price: number;
  capacity: number;
  image_r2_key: string | null;
  visible: number;
}

export interface StageWithRevenue extends StageWithSales {
  revenue: number; // COP paid in completed orders of this stage
}

export interface PublicEvent extends EventRow {
  sold: number;
  held: number;
  remaining: number;
  soldOut: boolean;
  // Price stages in date order (empty for a single-price event) and what can be
  // bought today. With stages, `price` is the current (or next) stage's price
  // and `remaining` also respects the stage quota.
  stages: StageView<StageWithRevenue>[];
  sale: Sale | null;
}

/** Thrown when the price the buyer saw is no longer the price to charge. */
export class PriceChangedError extends CheckoutError {
  unitPrice: number;
  constructor(unitPrice: number) {
    super("El precio cambió. Revisa el nuevo total y vuelve a intentarlo.", 409);
    this.unitPrice = unitPrice;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

// Events store their start as Colombia wall-clock time without a zone
// (e.g. 2026-01-17T20:00, sometimes with seconds); nowBogotaWallClock() gives
// "now" in the same format, to the second, so string comparison is exact for
// both stored forms. An event is on sale until it is over: until it starts, or
// until its last day ends when it has an end_date (ticketStages.eventEndsAt).

// A pending order holds its tickets for HOLD_MINUTES so concurrent buyers do
// not oversell a small quota. A paid order whose tickets are not issued yet
// (between Bold's approval and issueTicketsForOrder) holds them too, with no
// time limit. created_at is UTC 'YYYY-MM-DD HH:MM:SS', the format
// datetime('now') returns, so the comparison is a plain string one.
const HOLD_SINCE = `datetime('now', '-${HOLD_MINUTES} minutes')`;
const IS_HOLDING = `((status = 'pending' AND created_at > ${HOLD_SINCE})
   OR (status = 'completed' AND tickets_issued = 0))`;
const HELD_FOR_EVENT = `(SELECT COALESCE(SUM(quantity), 0) FROM ticket_orders
   WHERE event_id = e.id AND ${IS_HOLDING})`;

/**
 * Price stages of the given events with their issued (`sold`), held and paid
 * (`revenue`) counts, in one query. Map keyed by event id.
 */
export async function loadStagesWithSales(
  db: D1Database,
  eventIds: number[]
): Promise<Map<number, StageWithRevenue[]>> {
  const map = new Map<number, StageWithRevenue[]>();
  if (eventIds.length === 0) return map;
  // D1 caps bound parameters at 100; past that, read all stages and filter.
  const filtered = eventIds.length <= 90;
  const where = filtered
    ? `WHERE s.event_id IN (${eventIds.map(() => "?").join(", ")})`
    : "";
  const res = await db
    .prepare(
      `SELECT s.*,
              (SELECT COUNT(*) FROM tickets t
                 JOIN ticket_orders o ON o.id = t.ticket_order_id
                WHERE o.stage_id = s.id) AS sold,
              (SELECT COALESCE(SUM(quantity), 0) FROM ticket_orders
                WHERE stage_id = s.id AND ${IS_HOLDING}) AS held,
              (SELECT COALESCE(SUM(o.amount), 0) FROM ticket_orders o
                WHERE o.stage_id = s.id AND o.status = 'completed') AS revenue
       FROM event_price_stages s
       ${where}
       ORDER BY s.event_id, s.starts_on, s.id`
    )
    .bind(...(filtered ? eventIds : []))
    .all<StageWithRevenue>();
  const wanted = new Set(eventIds);
  for (const row of (res.results as StageWithRevenue[]) || []) {
    if (!wanted.has(row.event_id)) continue;
    const stage = {
      ...row,
      sold: Number(row.sold ?? 0),
      held: Number(row.held ?? 0),
      revenue: Number(row.revenue ?? 0),
    };
    const list = map.get(row.event_id);
    if (list) list.push(stage);
    else map.set(row.event_id, [stage]);
  }
  return map;
}

/** Issued tickets and tickets held by recent pending orders, for one event. */
async function eventUsage(
  db: D1Database,
  eventId: number
): Promise<{ sold: number; held: number }> {
  const row = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM tickets WHERE event_id = e.id) AS sold,
              ${HELD_FOR_EVENT} AS held
       FROM events e WHERE e.id = ?`
    )
    .bind(eventId)
    .first<{ sold: number; held: number }>();
  return { sold: Number(row?.sold ?? 0), held: Number(row?.held ?? 0) };
}

// One INSERT per ticket, each finding its order by Bold order id so it can run
// in the same batch that inserts the order. Returns the codes alongside.
function ticketInserts(
  db: D1Database,
  boldOrderId: string,
  eventId: number,
  qty: number
): D1PreparedStatement[] & { codes: string[] } {
  const stmt = db.prepare(
    `INSERT INTO tickets (ticket_order_id, event_id, code, status)
     SELECT id, ?, ?, 'valid' FROM ticket_orders WHERE bold_order_id = ?`
  );
  const codes: string[] = [];
  const inserts: D1PreparedStatement[] = [];
  for (let i = 0; i < qty; i++) {
    const code = generateTicketCode();
    codes.push(code);
    inserts.push(stmt.bind(eventId, code, boldOrderId));
  }
  return Object.assign(inserts, { codes });
}

async function orderIdByBoldId(db: D1Database, boldOrderId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT id FROM ticket_orders WHERE bold_order_id = ?`)
    .bind(boldOrderId)
    .first<{ id: number }>();
  return Number(row?.id);
}

// Ticket codes are UNIQUE; a collision (32^10 space) aborts the whole batch,
// so retry once with fresh codes.
async function withCodeRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (!String((e as any)?.message ?? e).includes("UNIQUE")) throw e;
    return run();
  }
}

function toPublic(
  row: EventRow & { sold?: number; held?: number },
  stages: StageWithRevenue[] = [],
  today: string = bogotaToday()
): PublicEvent {
  const sold = Number(row.sold ?? 0);
  const held = Number(row.held ?? 0);
  const eventRemaining = Math.max(0, row.capacity - sold - held);
  if (stages.length === 0) {
    return {
      ...row,
      sold,
      held,
      remaining: eventRemaining,
      soldOut: eventRemaining <= 0,
      stages: [],
      sale: null,
    };
  }
  const views = stageStatuses(stages, today);
  const sale = resolveSale(stages, today);
  const price =
    sale.state === "ended" ? views[views.length - 1].price : sale.stage.price;
  const remaining =
    sale.state === "current" ? Math.min(sale.remaining, eventRemaining) : 0;
  const soldOut =
    sale.state === "ended" || (sale.state === "current" && remaining <= 0);
  return { ...row, price, sold, held, remaining, soldOut, stages: views, sale };
}

/** Visible, not-yet-past events with their sold counts, soonest first. */
export async function getVisibleEvents(db: D1Database): Promise<PublicEvent[]> {
  // The WHERE repeats ticketStages.eventEndsAt in SQL (NULL || text is NULL;
  // NULLIF makes an empty end_date count as none, like the TS rule).
  const res = await db
    .prepare(
      `SELECT e.*, COALESCE(t.sold, 0) AS sold, ${HELD_FOR_EVENT} AS held
       FROM events e
       LEFT JOIN (SELECT event_id, COUNT(*) AS sold FROM tickets GROUP BY event_id) t
         ON t.event_id = e.id
       WHERE e.visible = 1
         AND COALESCE(NULLIF(e.end_date, '') || 'T23:59:59', e.event_date) > ?
       ORDER BY e.event_date ASC`
    )
    .bind(nowBogotaWallClock())
    .all<EventRow & { sold: number; held: number }>();
  const rows = (res.results as (EventRow & { sold: number; held: number })[]) || [];
  const stages = await loadStagesWithSales(db, rows.map((r) => r.id));
  const today = bogotaToday();
  return rows.map((r) => toPublic(r, stages.get(r.id), today));
}

/** A single public event by slug. Returns null when missing, hidden or past. */
export async function getEventBySlug(
  db: D1Database,
  slug: string
): Promise<PublicEvent | null> {
  const row = await db
    .prepare(
      `SELECT e.*, COALESCE(t.sold, 0) AS sold, ${HELD_FOR_EVENT} AS held
       FROM events e
       LEFT JOIN (SELECT event_id, COUNT(*) AS sold FROM tickets GROUP BY event_id) t
         ON t.event_id = e.id
       WHERE e.slug = ?`
    )
    .bind(slug)
    .first<(EventRow & { sold: number; held: number }) | null>();
  if (!row) return null;
  if (!row.visible || isEventOver(row)) return null;
  const stages = await loadStagesWithSales(db, [row.id]);
  return toPublic(row, stages.get(row.id));
}

export interface TicketCheckoutInput {
  eventSlug?: string;
  quantity?: number | string;
  // The unit price the buyer was shown. Only used to refuse with
  // PriceChangedError when it differs; the charge is always computed here.
  expectedUnitPrice?: number | string | null;
  buyer?: { name?: string; email?: string; phone?: string | null };
  /** Page language (es/en/fr): the language of the confirmation email. */
  lang?: string;
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
  input: TicketCheckoutInput,
  options: { paymentsEnabled: boolean }
): Promise<CreatedTicketOrder> {
  const slug = clean(input.eventSlug, 160);
  if (!slug) throw new CheckoutError("Evento inválido");

  const name = clean(input.buyer?.name, 100);
  const email = clean(input.buyer?.email, 120);
  if (!name) throw new CheckoutError("El nombre es obligatorio");
  if (!email || !EMAIL_RE.test(email))
    throw new CheckoutError("Se requiere un email válido");
  const rawPhone = clean(input.buyer?.phone, 40);
  if (!rawPhone) throw new CheckoutError("El teléfono es obligatorio");
  const phone = normalizeStoredPhone(rawPhone);
  if (!phone) throw new CheckoutError("Teléfono inválido");

  const qty = Math.trunc(Number(input.quantity));
  if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY)
    throw new CheckoutError("Cantidad inválida");

  const event = await db
    .prepare(
      `SELECT id, slug, name_es, price, capacity, visible, event_date, end_date
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
      end_date: string | null;
    } | null>();

  if (!event) throw new CheckoutError("El evento no existe");
  if (!event.visible || isEventOver(event))
    throw new CheckoutError("El evento no está disponible");

  // With price stages, the price and quota come from the stage on sale today
  // (Bogotá date + stage sales); otherwise from the event.
  const stages = (await loadStagesWithSales(db, [event.id])).get(event.id) ?? [];
  let stageId: number | null = null;
  let stageRemaining = Infinity;
  let price = Number(event.price);
  if (stages.length > 0) {
    const sale = resolveSale(stages, bogotaToday());
    if (sale.state === "upcoming")
      throw new CheckoutError("La venta aún no está abierta", 400, "not_open");
    if (sale.state === "ended")
      throw new CheckoutError("Entradas agotadas", 400, "sold_out");
    stageId = sale.stage.id;
    stageRemaining = sale.remaining;
    price = Number(sale.stage.price);
  }

  const unit = Math.trunc(price);
  if (!Number.isFinite(unit) || unit < 0)
    throw new CheckoutError("Precio del evento inválido");

  const expected = input.expectedUnitPrice;
  if (expected != null && expected !== "") {
    const shown = Math.trunc(Number(expected));
    if (Number.isFinite(shown) && shown !== unit) throw new PriceChangedError(unit);
  }

  // Capacity check: issued tickets + tickets held by recent pending orders,
  // against the event capacity and the stage quota. The INSERT below repeats
  // the check atomically, so concurrent buyers cannot both take the last seats.
  const usage = await eventUsage(db, event.id);
  const remaining = Math.min(event.capacity - usage.sold - usage.held, stageRemaining);
  if (remaining <= 0) throw new CheckoutError("Entradas agotadas", 400, "sold_out");
  if (qty > remaining) {
    const left = remaining === 1 ? "Solo queda 1 entrada" : `Solo quedan ${remaining} entradas`;
    throw new CheckoutError(
      stageId != null ? `${left} a este precio` : left,
      400,
      stageId != null ? "only_left_stage" : "only_left",
      { n: remaining }
    );
  }

  // One buyer cannot hold more than MAX_QTY seats of an event with unpaid
  // orders (each retry of a closed payment window would otherwise add a hold).
  const pendingRow = await db
    .prepare(
      `SELECT COALESCE(SUM(quantity), 0) AS n FROM ticket_orders
       WHERE event_id = ? AND lower(buyer_email) = lower(?)
         AND status = 'pending' AND created_at > ${HOLD_SINCE}`
    )
    .bind(event.id, email)
    .first<{ n: number }>();
  if (Number(pendingRow?.n ?? 0) + qty > MAX_QTY)
    throw new CheckoutError(
      `Ya tienes un pago en curso para este evento. Termínalo o espera ${HOLD_MINUTES} minutos.`,
      409,
      "pending_payment"
    );

  const isFree = unit === 0;
  // Refuse a paid checkout before writing anything when Bold is not configured.
  if (!isFree && !options.paymentsEnabled)
    throw new CheckoutError("Payment provider not configured", 500);
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

  // Inserted only if the seats still fit: D1 runs each statement atomically
  // and serializes writes, so the capacity re-check and the insert cannot be
  // interleaved with another checkout.
  const stageGuard =
    stageId != null
      ? `AND (SELECT COUNT(*) FROM tickets t
                JOIN ticket_orders o ON o.id = t.ticket_order_id
               WHERE o.stage_id = ?17)
          + (SELECT COALESCE(SUM(quantity), 0) FROM ticket_orders
              WHERE stage_id = ?17 AND ${IS_HOLDING})
          + ?10 <= (SELECT capacity FROM event_price_stages WHERE id = ?17)`
      : "";
  const insertOrder = db
    .prepare(
      `INSERT INTO ticket_orders
        (bold_order_id, status, provider, provider_status, currency, amount,
         event_id, event_name, unit_price, quantity,
         buyer_name, buyer_email, buyer_phone, access_token,
         tickets_issued, paid_at, stage_id, locale)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18
       FROM events e
       WHERE e.id = ?7
         AND (SELECT COUNT(*) FROM tickets WHERE event_id = e.id)
           + ${HELD_FOR_EVENT}
           + ?10 <= e.capacity
         ${stageGuard}`
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
      phone,
      accessToken,
      isFree ? 1 : 0,
      paidAt,
      stageId,
      orderLocale(input.lang)
    );

  // Free orders are completed at once: the order and its tickets are written in
  // one batch (a D1 batch is a single transaction), so they exist together or
  // not at all. The ticket inserts find the order by its Bold id, so they add
  // nothing when the guarded order insert was refused.
  let inserted: number;
  if (isFree) {
    const results = await withCodeRetry(() =>
      db.batch([insertOrder, ...ticketInserts(db, orderId, event.id, qty)])
    );
    inserted = results[0].meta.changes;
  } else {
    inserted = (await insertOrder.run()).meta.changes;
  }
  if (!inserted)
    throw new CheckoutError(
      "Las entradas se acaban de agotar o quedan menos de las que pediste. Recarga la página e inténtalo de nuevo.",
      409,
      "seats_taken"
    );
  const newOrderId = await orderIdByBoldId(db, orderId);

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
  lang?: string;
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

  // Courtesies count against the event capacity only (never a stage quota),
  // including the tickets held by recent pending orders.
  const usage = await eventUsage(db, event.id);
  const remaining = event.capacity - usage.sold - usage.held;
  if (remaining < qty) {
    throw new CheckoutError(`Solo quedan ${Math.max(0, remaining)} cupos disponibles`);
  }

  const orderId = generateOrderId("ticket");
  const accessToken = crypto.randomUUID();

  const insertOrder = db
    .prepare(
      `INSERT INTO ticket_orders
        (bold_order_id, status, provider, provider_status, currency, amount,
         event_id, event_name, unit_price, quantity,
         buyer_name, buyer_email, buyer_phone, access_token,
         tickets_issued, paid_at, locale)
       VALUES (?, 'completed', 'courtesy', 'COMPLIMENTARY', 'COP', 0,
               ?, ?, 0, ?,
               ?, ?, ?, ?,
               1, CURRENT_TIMESTAMP, ?)`
    )
    .bind(
      orderId,
      event.id,
      event.name_es,
      qty,
      name,
      email,
      clean(input.buyer?.phone, 40),
      accessToken,
      orderLocale(input.lang)
    );

  // Order + tickets in one batch (single transaction): all or nothing.
  let codes: string[] = [];
  await withCodeRetry(() => {
    const inserts = ticketInserts(db, orderId, event.id, qty);
    codes = inserts.codes;
    return db.batch([insertOrder, ...inserts]);
  });
  const newOrderId = await orderIdByBoldId(db, orderId);

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
  locale?: string | null;
}

/**
 * Issue tickets for a completed order. Idempotent AND race-safe: the webhook and
 * the browser confirm can call this concurrently. Everything happens in ONE
 * D1 batch (a single transaction, serialized with other writes):
 *   1. repair: an order left "claimed" with zero tickets (an older version
 *      claimed first and inserted later, so a crash in between left it empty)
 *      is reset to unclaimed;
 *   2. one INSERT per ticket, guarded by "order completed and unclaimed";
 *   3. the claim (tickets_issued 0 -> 1).
 * Either all tickets and the claim are written, or nothing is. A concurrent
 * caller that runs second finds the order claimed: its inserts and claim
 * change nothing and it returns the existing codes.
 */
export async function issueTicketsForOrder(
  db: D1Database,
  boldOrderId: string
): Promise<{ issued: number; codes: string[] }> {
  const order = await db
    .prepare(
      `SELECT id, status, event_id, quantity, stage_id FROM ticket_orders WHERE bold_order_id = ?`
    )
    .bind(boldOrderId)
    .first<{
      id: number;
      status: string;
      event_id: number;
      quantity: number;
      stage_id: number | null;
    }>();

  if (!order || order.status !== "completed") return { issued: 0, codes: [] };

  const existingCodes = async () => {
    const existing = await db
      .prepare(`SELECT code FROM tickets WHERE ticket_order_id = ? ORDER BY id`)
      .bind(order.id)
      .all<{ code: string }>();
    return ((existing.results as { code: string }[]) || []).map((r) => r.code);
  };

  // Fast path: already issued.
  const already = await existingCodes();
  if (already.length > 0) return { issued: 0, codes: already };

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
  if (order.stage_id != null) {
    const st = await db
      .prepare(
        `SELECT s.capacity AS capacity,
                (SELECT COUNT(*) FROM tickets t
                   JOIN ticket_orders o ON o.id = t.ticket_order_id
                  WHERE o.stage_id = s.id) AS sold
         FROM event_price_stages s WHERE s.id = ?`
      )
      .bind(order.stage_id)
      .first<{ capacity: number; sold: number }>();
    if (st && Number(st.sold) + order.quantity > Number(st.capacity)) {
      console.error(
        `Ticket stage oversell: order ${boldOrderId} issues ${order.quantity} but stage ${order.stage_id} is at ${st.sold}/${st.capacity}`
      );
    }
  }

  const repair = db
    .prepare(
      `UPDATE ticket_orders SET tickets_issued = 0
       WHERE id = ? AND tickets_issued = 1
         AND NOT EXISTS (SELECT 1 FROM tickets WHERE ticket_order_id = ?)`
    )
    .bind(order.id, order.id);
  const insert = db.prepare(
    `INSERT INTO tickets (ticket_order_id, event_id, code)
     SELECT ?, ?, ? WHERE EXISTS (
       SELECT 1 FROM ticket_orders
       WHERE id = ? AND status = 'completed' AND tickets_issued = 0
     )`
  );
  const claim = db
    .prepare(
      `UPDATE ticket_orders SET tickets_issued = 1
       WHERE id = ? AND status = 'completed' AND tickets_issued = 0`
    )
    .bind(order.id);

  let codes: string[] = [];
  const results = await withCodeRetry(() => {
    codes = Array.from({ length: order.quantity }, generateTicketCode);
    return db.batch([
      repair,
      ...codes.map((code) => insert.bind(order.id, order.event_id, code, order.id)),
      claim,
    ]);
  });

  // The last statement is the claim: it changed a row only if this call's
  // inserts ran. Codes are read back from D1 either way.
  const issued = results[results.length - 1].meta.changes > 0 ? codes.length : 0;
  return { issued, codes: await existingCodes() };
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
  // A multi-day pass (D25) shows as used only once it entered on the last day.
  const tks =
    event && isMultiDay(event)
      ? await db
          .prepare(
            `SELECT code,
                    CASE WHEN EXISTS (
                      SELECT 1 FROM ticket_checkins c
                      WHERE c.ticket_id = tickets.id AND c.door_day = ?
                    ) THEN 'checked_in' ELSE 'valid' END AS status,
                    checked_in_at
             FROM tickets WHERE ticket_order_id = ? ORDER BY id`
          )
          .bind(event.end_date, order.id)
          .all<{ code: string; status: string; checked_in_at: string | null }>()
      : await db
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

/**
 * Full ticket-order view by permanent access token (bearer). A completed order
 * without tickets (issuance failed after payment) is repaired here too, since
 * this page never goes through the confirm endpoint.
 */
export async function getTicketOrderByToken(
  db: D1Database,
  token: string
): Promise<TicketOrderView> {
  const order = await db
    .prepare(`SELECT * FROM ticket_orders WHERE access_token = ?`)
    .bind(token)
    .first<TicketOrderRow | null>();
  const view = await loadTicketOrderView(db, order);
  if (view.order?.status === "completed" && view.tickets.length === 0) {
    await issueTicketsForOrder(db, view.order.bold_order_id);
    return loadTicketOrderView(db, order);
  }
  return view;
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

// Multi-day events (D25) add day/days to "ok", today/day/days to "already" and
// answer "out_of_range" outside the event's door days.
export type CheckInResult =
  | { result: "ok"; attendee: string; eventName: string; day?: number; days?: number }
  | {
      result: "already";
      attendee: string;
      eventName: string;
      checkedInAt: string;
      today?: boolean;
      day?: number;
      days?: number;
    }
  | {
      result: "out_of_range";
      attendee: string;
      eventName: string;
      startDate: string;
      endDate: string;
    }
  | { result: "not_found" }
  | { result: "not_paid" };

/**
 * Check in a ticket by code. Atomic against double-scan: the UPDATE is guarded
 * by status='valid' and we inspect meta.changes. A multi-day pass is checked
 * in once per door day instead (checkInForDoorDay).
 */
export async function checkInTicket(
  db: D1Database,
  rawCode: string,
  now: number = Date.now()
): Promise<CheckInResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { result: "not_found" };

  const row = await db
    .prepare(
      `SELECT t.id AS ticket_id, t.status AS ticket_status,
              t.checked_in_at AS checked_in_at,
              o.status AS order_status, o.buyer_name AS buyer_name,
              o.event_name AS event_name,
              e.event_date AS event_date, e.end_date AS end_date
       FROM tickets t
       JOIN ticket_orders o ON o.id = t.ticket_order_id
       LEFT JOIN events e ON e.id = t.event_id
       WHERE t.code = ?`
    )
    .bind(code)
    .first<{
      ticket_id: number;
      ticket_status: string;
      checked_in_at: string | null;
      order_status: string;
      buyer_name: string;
      event_name: string;
      event_date: string;
      end_date: string | null;
    } | null>();

  if (!row) return { result: "not_found" };
  if (row.order_status !== "completed") return { result: "not_paid" };
  if (isMultiDay(row)) return checkInForDoorDay(db, row, now);
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

/**
 * Multi-day pass: one entry per door day. The INSERT on the (ticket_id,
 * door_day) primary key is the atomic claim; the first entry also marks the
 * ticket checked_in so the admin counts keep meaning "entered at least once".
 */
async function checkInForDoorDay(
  db: D1Database,
  row: {
    ticket_id: number;
    buyer_name: string;
    event_name: string;
    event_date: string;
    end_date: string | null;
  },
  now: number
): Promise<CheckInResult> {
  const day = doorDay(now);
  const index = doorDayIndex(row, day);
  if (!index) {
    return {
      result: "out_of_range",
      attendee: row.buyer_name,
      eventName: row.event_name,
      startDate: row.event_date.slice(0, 10),
      endDate: row.end_date ?? "",
    };
  }

  const [claim] = await db.batch([
    db
      .prepare(`INSERT OR IGNORE INTO ticket_checkins (ticket_id, door_day) VALUES (?, ?)`)
      .bind(row.ticket_id, day),
    db
      .prepare(
        `UPDATE tickets SET status = 'checked_in', checked_in_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'valid'`
      )
      .bind(row.ticket_id),
  ]);

  if (claim.meta.changes > 0) {
    return { result: "ok", attendee: row.buyer_name, eventName: row.event_name, ...index };
  }

  const prev = await db
    .prepare(`SELECT checked_in_at FROM ticket_checkins WHERE ticket_id = ? AND door_day = ?`)
    .bind(row.ticket_id, day)
    .first<{ checked_in_at: string } | null>();
  return {
    result: "already",
    attendee: row.buyer_name,
    eventName: row.event_name,
    checkedInAt: prev?.checked_in_at || "",
    today: true,
    ...index,
  };
}

// --- Admin reads ---

export async function getEventsForAdmin(db: D1Database): Promise<any[]> {
  const res = await db
    .prepare(
      `SELECT e.*,
              COALESCE(t.sold, 0) AS sold,
              COALESCE(t.checked_in, 0) AS checked_in,
              ${HELD_FOR_EVENT} AS held
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
  const rows = (res.results as any[]) || [];
  const stages = await loadStagesWithSales(db, rows.map((r) => Number(r.id)));
  const today = bogotaToday();
  return rows.map((r) => {
    const list = stages.get(Number(r.id)) ?? [];
    if (list.length === 0) return { ...r, stages: [] };
    const sale = resolveSale(list, today);
    return {
      ...r,
      stages: stageStatuses(list, today),
      current_stage_name: sale.state === "ended" ? null : sale.stage.name_es,
      current_price: sale.state === "ended" ? null : sale.stage.price,
      sale_state: sale.state,
    };
  });
}

export async function getTicketOrdersForAdmin(
  db: D1Database,
  eventId?: number
): Promise<any[]> {
  const base = `SELECT o.*, s.name_es AS stage_name,
       (SELECT COUNT(*) FROM tickets WHERE ticket_order_id = o.id) AS ticket_count,
       (SELECT COUNT(*) FROM tickets WHERE ticket_order_id = o.id AND status = 'checked_in') AS checked_in_count
     FROM ticket_orders o
     LEFT JOIN event_price_stages s ON s.id = o.stage_id`;
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
    .first<any>();
  if (!order) return null;
  const tickets = await db
    .prepare(
      `SELECT id, code, status, checked_in_at FROM tickets WHERE ticket_order_id = ? ORDER BY id`
    )
    .bind(id)
    .all();
  const list = (tickets.results as any[]) || [];

  // Multi-day pass (D25): every entry per door day, numbered "día X de N".
  const event = await db
    .prepare(`SELECT event_date, end_date FROM events WHERE id = ?`)
    .bind(order.event_id)
    .first<{ event_date: string; end_date: string | null } | null>();
  if (!event || !isMultiDay(event)) {
    return { ...order, tickets: list.map((t) => ({ ...t, checkins: [] })) };
  }
  const entries = await db
    .prepare(
      `SELECT c.ticket_id, c.door_day, c.checked_in_at
       FROM ticket_checkins c JOIN tickets t ON t.id = c.ticket_id
       WHERE t.ticket_order_id = ? ORDER BY c.door_day`
    )
    .bind(id)
    .all<{ ticket_id: number; door_day: string; checked_in_at: string }>();
  const byTicket = new Map<number, { day: number; days: number; checked_in_at: string }[]>();
  for (const c of entries.results || []) {
    const index = doorDayIndex(event, c.door_day);
    if (!index) continue;
    const arr = byTicket.get(c.ticket_id) ?? [];
    arr.push({ ...index, checked_in_at: c.checked_in_at });
    byTicket.set(c.ticket_id, arr);
  }
  return {
    ...order,
    tickets: list.map((t) => ({ ...t, checkins: byTicket.get(Number(t.id)) ?? [] })),
  };
}
