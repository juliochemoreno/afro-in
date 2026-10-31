// Admin-side event helpers: validation + column mapping for INSERT/UPDATE.
// Mirrors the shape of lib/productAdmin.ts but for the events table.

import { BOLD_MIN_AMOUNT } from "@/lib/orders";
import { validateStages, type CleanStage } from "@/lib/ticketStages";

export const EVENT_COLUMNS = [
  "slug",
  "name_es",
  "name_en",
  "name_fr",
  "description_es",
  "description_en",
  "description_fr",
  "venue",
  "city",
  "department",
  "country",
  "event_date",
  "price",
  "capacity",
  "image_r2_key",
  "visible",
] as const;

const str = (v: unknown, max = 300): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

/** Returns an error message string, or null when the input is valid. */
export function validateEventInput(body: any): string | null {
  if (!body || typeof body !== "object") return "Datos inválidos";
  const slug = str(body.slug, 160);
  if (!slug || !/^[a-z0-9-]+$/.test(slug))
    return "El slug es obligatorio (minúsculas, números y guiones)";
  if (!str(body.name_es, 200)) return "El nombre (ES) es obligatorio";
  const date = str(body.event_date, 40);
  if (!date) return "La fecha es obligatoria";
  // Colombia wall-clock time; sales close by string comparison (lib/tickets.ts),
  // which is only exact for this format.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(date))
    return "La fecha debe tener el formato AAAA-MM-DDTHH:MM";
  const price = Math.trunc(Number(body.price));
  if (!Number.isFinite(price) || price < 0)
    return "El precio debe ser un número mayor o igual a 0";
  if (price > 0 && price < BOLD_MIN_AMOUNT)
    return `El precio mínimo para eventos pagos es ${BOLD_MIN_AMOUNT} COP (o 0 para evento gratuito)`;
  const capacity = Math.trunc(Number(body.capacity));
  if (!Number.isFinite(capacity) || capacity < 1)
    return "El cupo debe ser al menos 1";
  return null;
}

/**
 * The price stages in an admin request. `stages: null` means the request does
 * not touch them (no `stages` key); an empty list removes them all. With
 * stages, the event's own price becomes the first stage's price so readers
 * that do not know stages still see a sensible number.
 */
export function parseStages(
  body: any
): { stages: CleanStage[] | null } | { error: string } {
  if (!body || typeof body !== "object" || body.stages == null) return { stages: null };
  const res = validateStages(body.stages, {
    eventDate: String(body.event_date ?? ""),
    minAmount: BOLD_MIN_AMOUNT,
  });
  if ("error" in res) return res;
  if (res.stages.length > 0) body.price = res.stages[0].price;
  return res;
}

const STAGE_VALUES = (s: CleanStage) => [
  s.name_es,
  s.name_en,
  s.name_fr,
  s.price,
  s.capacity,
  s.starts_on,
  s.ends_on,
];

/** INSERTs for new stages of the event whose slug is given (same batch as the event). */
export function stageInsertsBySlug(
  db: D1Database,
  slug: string,
  stages: CleanStage[]
): D1PreparedStatement[] {
  const stmt = db.prepare(
    `INSERT INTO event_price_stages
       (event_id, name_es, name_en, name_fr, price, capacity, starts_on, ends_on, updated_at)
     SELECT id, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP FROM events WHERE slug = ?`
  );
  return stages.map((s) => stmt.bind(...STAGE_VALUES(s), slug));
}

/**
 * Statements that make the event's stages match `stages`: update the ones
 * with an id, insert the new ones, delete the missing ones. Deletes skip
 * stages that have orders (the caller refuses those first with a message).
 */
export function stageSyncStatements(
  db: D1Database,
  eventId: number,
  stages: CleanStage[],
  removedIds: number[]
): D1PreparedStatement[] {
  const del = db.prepare(
    `DELETE FROM event_price_stages
     WHERE id = ? AND event_id = ?
       AND NOT EXISTS (SELECT 1 FROM ticket_orders WHERE stage_id = ?)`
  );
  const upd = db.prepare(
    `UPDATE event_price_stages
     SET name_es = ?, name_en = ?, name_fr = ?, price = ?, capacity = ?,
         starts_on = ?, ends_on = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND event_id = ?`
  );
  const ins = db.prepare(
    `INSERT INTO event_price_stages
       (event_id, name_es, name_en, name_fr, price, capacity, starts_on, ends_on, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  );
  return [
    ...removedIds.map((id) => del.bind(id, eventId, id)),
    ...stages.map((s) =>
      s.id != null
        ? upd.bind(...STAGE_VALUES(s), s.id, eventId)
        : ins.bind(eventId, ...STAGE_VALUES(s))
    ),
  ];
}

/** Ordered values matching EVENT_COLUMNS for binding into a prepared statement. */
export function eventValues(body: any): unknown[] {
  return [
    str(body.slug, 160),
    str(body.name_es, 200),
    str(body.name_en, 200),
    str(body.name_fr, 200),
    str(body.description_es, 4000),
    str(body.description_en, 4000),
    str(body.description_fr, 4000),
    str(body.venue, 200),
    str(body.city, 120),
    str(body.department, 120),
    str(body.country, 120) || "Colombia",
    str(body.event_date, 40),
    Math.trunc(Number(body.price)),
    Math.trunc(Number(body.capacity)),
    str(body.image_r2_key, 300),
    body.visible ? 1 : 0,
  ];
}
