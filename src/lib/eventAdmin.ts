// Admin-side event helpers: validation + column mapping for INSERT/UPDATE.
// Mirrors the shape of lib/productAdmin.ts but for the events table.

import { BOLD_MIN_AMOUNT } from "@/lib/orders";

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
  if (!str(body.event_date, 40)) return "La fecha es obligatoria";
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
