// events table column mapping for the admin INSERT/UPDATE (lib/eventAdmin.ts
// re-exports it). Pure, no "@/" imports, so the tests can load it directly.

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
  "end_date",
  "price",
  "capacity",
  "image_r2_key",
  "visible",
] as const;

const str = (v: unknown, max = 300): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

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
    str(body.end_date, 10),
    Math.trunc(Number(body.price)),
    Math.trunc(Number(body.capacity)),
    str(body.image_r2_key, 300),
    body.visible ? 1 : 0,
  ];
}

// Columns an admin page opened before they existed does not send: an UPDATE
// without the key keeps the stored value; the key sent empty clears it.
const KEEP_WHEN_MISSING = new Set<string>(["end_date"]);

/** SET clause and values for updating an event from an admin request body. */
export function eventUpdate(body: any): { set: string; values: unknown[] } {
  const values = eventValues(body);
  const cols: string[] = [];
  const vals: unknown[] = [];
  EVENT_COLUMNS.forEach((c, i) => {
    if (KEEP_WHEN_MISSING.has(c) && !Object.prototype.hasOwnProperty.call(body, c)) return;
    cols.push(`${c} = ?`);
    vals.push(values[i]);
  });
  return { set: cols.join(", "), values: vals };
}
