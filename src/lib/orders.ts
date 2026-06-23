// Store order data layer. The cart lives in the browser (localStorage), so its
// prices and names are UNTRUSTED. Every checkout re-resolves each line against
// D1 by slug, re-prices it from the products table, and rejects anything that is
// hidden or out of stock. The client-sent price is never used.

import { generateOrderId } from "@/lib/bold";

export const BOLD_MIN_AMOUNT = 1000; // Bold minimum charge, COP
const MAX_LINES = 50;
const MAX_QTY = 99;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (s: unknown, max = 200): string | null => {
  const v = typeof s === "string" ? s.trim() : "";
  return v ? v.slice(0, max) : null;
};

export class CheckoutError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface CheckoutItemInput {
  slug?: string;
  sku?: string;
  size?: string;
  color?: string;
  quantity?: number | string;
}
export interface CheckoutCustomer {
  name?: string;
  email?: string;
  phone?: string | null;
}
export interface CheckoutShipping {
  country?: string | null;
  department?: string | null;
  city?: string | null;
  address?: string | null;
  notes?: string | null;
}
export interface CheckoutInput {
  items?: CheckoutItemInput[];
  customer?: CheckoutCustomer;
  shipping?: CheckoutShipping;
}

export interface CreatedOrder {
  id: number;
  orderId: string;
  amount: number; // COP
  subtotal: number;
  itemCount: number;
  currency: string;
}

interface PricedProduct {
  id: number;
  slug: string;
  sku: string | null;
  name_es: string;
  price: number;
  visible: number;
  in_stock: number;
}

interface OrderLine {
  product_id: number;
  slug: string;
  sku: string | null;
  name: string;
  size: string | null;
  color: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

/**
 * Validate a checkout payload server-side and create a pending order (+ items).
 * Throws CheckoutError (with an HTTP status) on any validation failure.
 * Shipping is collected but not charged in v1 (amount == subtotal).
 */
export async function createPendingOrder(
  db: D1Database,
  input: CheckoutInput
): Promise<CreatedOrder> {
  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (rawItems.length === 0) throw new CheckoutError("El carrito está vacío");
  if (rawItems.length > MAX_LINES)
    throw new CheckoutError("Demasiados productos en el carrito");

  const name = clean(input.customer?.name, 100);
  const email = clean(input.customer?.email, 120);
  if (!name) throw new CheckoutError("El nombre es obligatorio");
  if (!email || !EMAIL_RE.test(email))
    throw new CheckoutError("Se requiere un email válido");

  // Resolve every referenced product from D1 by its canonical slug.
  const slugs = Array.from(
    new Set(rawItems.map((i) => clean(i.slug, 160)).filter(Boolean) as string[])
  );
  if (slugs.length === 0) throw new CheckoutError("Productos inválidos");

  const placeholders = slugs.map(() => "?").join(",");
  const res = await db
    .prepare(
      `SELECT id, slug, sku, name_es, price, visible, in_stock
       FROM products WHERE slug IN (${placeholders})`
    )
    .bind(...slugs)
    .all<PricedProduct>();
  const bySlug = new Map<string, PricedProduct>();
  for (const p of (res.results as PricedProduct[]) || []) bySlug.set(p.slug, p);

  const lines: OrderLine[] = [];
  let subtotal = 0;
  let itemCount = 0;

  for (const it of rawItems) {
    const slug = clean(it.slug, 160);
    if (!slug) throw new CheckoutError("Producto sin identificador");

    const p = bySlug.get(slug);
    if (!p) throw new CheckoutError("Un producto del carrito ya no existe");
    if (!p.visible || !p.in_stock)
      throw new CheckoutError(`"${p.name_es}" ya no está disponible`);

    const qty = Math.trunc(Number(it.quantity));
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY)
      throw new CheckoutError("Cantidad inválida");

    const unit = Math.trunc(Number(p.price));
    if (!Number.isFinite(unit) || unit <= 0)
      throw new CheckoutError(`Precio inválido para "${p.name_es}"`);

    const lineTotal = unit * qty;
    subtotal += lineTotal;
    itemCount += qty;

    lines.push({
      product_id: p.id,
      slug: p.slug,
      sku: p.sku,
      name: p.name_es,
      size: clean(it.size, 40),
      color: clean(it.color, 40),
      unit_price: unit,
      quantity: qty,
      line_total: lineTotal,
    });
  }

  if (subtotal < BOLD_MIN_AMOUNT)
    throw new CheckoutError(`El total mínimo es ${BOLD_MIN_AMOUNT} COP`);

  const currency = "COP";
  const amount = subtotal; // v1: no shipping fee
  const orderId = generateOrderId("order");
  const s = input.shipping || {};

  const orderRes = await db
    .prepare(
      `INSERT INTO orders
        (bold_order_id, status, provider, currency, amount, subtotal, item_count,
         customer_name, customer_email, customer_phone,
         ship_country, ship_department, ship_city, ship_address, ship_notes)
       VALUES (?, 'pending', 'bold', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      orderId,
      currency,
      amount,
      subtotal,
      itemCount,
      name,
      email,
      clean(input.customer?.phone, 40),
      clean(s.country, 80),
      clean(s.department, 80),
      clean(s.city, 80),
      clean(s.address, 300),
      clean(s.notes, 300)
    )
    .run();

  const orderRowId = orderRes.meta.last_row_id as number;

  const stmt = db.prepare(
    `INSERT INTO order_items
      (order_id, product_id, slug, sku, name, size, color, unit_price, quantity, line_total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  await db.batch(
    lines.map((l) =>
      stmt.bind(
        orderRowId,
        l.product_id,
        l.slug,
        l.sku,
        l.name,
        l.size,
        l.color,
        l.unit_price,
        l.quantity,
        l.line_total
      )
    )
  );

  return { id: orderRowId, orderId, amount, subtotal, itemCount, currency };
}

// --- Admin reads ---

export async function getOrders(db: D1Database): Promise<any[]> {
  const res = await db
    .prepare(`SELECT * FROM orders ORDER BY created_at DESC`)
    .all();
  return (res.results as any[]) || [];
}

export async function getOrderById(
  db: D1Database,
  id: number
): Promise<any | null> {
  const order = await db
    .prepare(`SELECT * FROM orders WHERE id = ?`)
    .bind(id)
    .first();
  if (!order) return null;
  const items = await db
    .prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id`)
    .bind(id)
    .all();
  return { ...order, items: (items.results as any[]) || [] };
}
