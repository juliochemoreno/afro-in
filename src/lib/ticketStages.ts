// Staged ticket prices (presales). Pure logic, no D1 and no "@/" imports so the
// tests can load it directly. lib/tickets.ts feeds it the stages with their
// sales; the checkout charges the price of the stage resolveSale picks.
//
// Rules (Julio, 2026-10-31):
// - Stage dates are whole Bogotá days (starts_on / ends_on, inclusive); a stage
//   without ends_on runs until the event's last day.
// - Each stage sells only its own quota; a stage ended by date loses its
//   leftovers.
// - A stage whose quota is full (sold + held) opens the next stage at once,
//   even before that stage's start date; the opened stage keeps its ends_on.

// Pending payments hold their tickets this long (lib/tickets.ts).
export const HOLD_MINUTES = 30;
export const MAX_STAGES = 10;

export interface StageRow {
  id: number;
  event_id: number;
  name_es: string;
  name_en: string | null;
  name_fr: string | null;
  price: number;
  capacity: number;
  starts_on: string;
  ends_on: string | null;
}

export interface StageWithSales extends StageRow {
  sold: number; // issued tickets
  held: number; // tickets in pending orders younger than HOLD_MINUTES
}

export type StageStatus = "past" | "soldout" | "current" | "upcoming";

export type StageView<T extends StageWithSales = StageWithSales> = T & {
  status: StageStatus;
  remaining: number;
};

export type Sale =
  | { state: "current"; stage: StageView; remaining: number }
  | { state: "upcoming"; stage: StageView; opensOn: string }
  | { state: "ended" };

// Colombia is UTC-5 all year (no daylight saving).
const BOGOTA_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;

// "Now" as Colombia wall-clock time, to the second (YYYY-MM-DDTHH:MM:SS), the
// format events.event_date is compared with as a string.
export function nowBogotaWallClock(now: number = Date.now()): string {
  return new Date(now - BOGOTA_UTC_OFFSET_MS).toISOString().slice(0, 19);
}

// Today's date in Bogotá (YYYY-MM-DD).
export function bogotaToday(now: Date = new Date()): string {
  return nowBogotaWallClock(now.getTime()).slice(0, 10);
}

// When an event is over, as a wall-clock string compared with
// nowBogotaWallClock(): the end of its last day (end_date, multi-day events) or
// its start (event_date). 23:59:59 itself already counts as over (1 s early).
// getVisibleEvents (lib/tickets.ts) repeats this rule in SQL.
export function eventEndsAt(e: { event_date: string; end_date?: string | null }): string {
  return e.end_date ? `${e.end_date}T23:59:59` : e.event_date;
}

/** Past events are hidden and no longer on sale. */
export function isEventOver(
  e: { event_date: string; end_date?: string | null },
  now: string = nowBogotaWallClock()
): boolean {
  return eventEndsAt(e) <= now;
}

function byStart<T extends { starts_on: string; id?: number }>(a: T, b: T): number {
  if (a.starts_on !== b.starts_on) return a.starts_on < b.starts_on ? -1 : 1;
  return (a.id ?? 0) - (b.id ?? 0);
}

/** Every stage with its status on `today` and its remaining tickets, in date order. */
export function stageStatuses<T extends StageWithSales>(
  stages: T[],
  today: string
): StageView<T>[] {
  let opened = false; // a stage before was sold out: the next one opens early
  let foundCurrent = false;
  return [...stages].sort(byStart).map((s): StageView<T> => {
    const remaining = Math.max(0, s.capacity - s.sold - s.held);
    const ended = s.ends_on != null && s.ends_on < today;
    let status: StageStatus;
    if (foundCurrent) {
      status = ended ? "past" : "upcoming";
    } else if (ended) {
      // A sold-out stage opens the next one even after its own end date.
      status = remaining <= 0 ? "soldout" : "past";
      if (remaining <= 0) opened = true;
    } else if (remaining <= 0) {
      status = "soldout";
      opened = true;
    } else if (s.starts_on <= today || opened) {
      status = "current";
      foundCurrent = true;
    } else {
      status = "upcoming";
    }
    return { ...s, status, remaining };
  });
}

/** What can be bought on `today`: the current stage, the next opening, or nothing. */
export function resolveSale(stages: StageWithSales[], today: string): Sale {
  const views = stageStatuses(stages, today);
  const current = views.find((s) => s.status === "current");
  if (current) return { state: "current", stage: current, remaining: current.remaining };
  const next = views.find((s) => s.status === "upcoming");
  if (next) return { state: "upcoming", stage: next, opensOn: next.starts_on };
  return { state: "ended" };
}

/** What the public web may know about the sale: no counts, only the stage in force. */
export interface PublicSale {
  state: "current" | "upcoming" | "ended";
  current: { id: number; price: number } | null;
}

export function publicSale(sale: Sale | null): PublicSale {
  if (!sale) return { state: "ended", current: null };
  if (sale.state === "current")
    return { state: "current", current: { id: sale.stage.id, price: sale.stage.price } };
  return { state: sale.state, current: null };
}

export function stageName(
  stage: Pick<StageRow, "name_es" | "name_en" | "name_fr">,
  lang: string
): string {
  const name = lang === "en" ? stage.name_en : lang === "fr" ? stage.name_fr : null;
  return name || stage.name_es;
}

// --- Admin validation ---

export interface CleanStage {
  id?: number;
  name_es: string;
  name_en: string | null;
  name_fr: string | null;
  price: number;
  capacity: number;
  starts_on: string;
  ends_on: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const str = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

/**
 * Validate an event's optional last day (multi-day events). Empty means a
 * one-day event. Returns a Spanish error message (shown in the admin).
 */
export function validateEndDate(
  eventDate: string,
  endDate: unknown
): { endDate: string | null } | { error: string } {
  const end = str(endDate, 10);
  if (end == null) return { endDate: null };
  if (!isDate(end)) return { error: "El último día debe ser AAAA-MM-DD" };
  if (end <= String(eventDate || "").slice(0, 10))
    return { error: "El último día debe ser después de la fecha de inicio" };
  return { endDate: end };
}

/**
 * Validate the stages an admin submits for an event. Returns them cleaned and
 * sorted by start date, or a Spanish error message (shown in the admin).
 */
export function validateStages(
  input: unknown,
  opts: { eventDate: string; endDate?: string | null; minAmount: number }
): { stages: CleanStage[] } | { error: string } {
  if (!Array.isArray(input)) return { error: "Las etapas deben ser una lista" };
  if (input.length > MAX_STAGES) return { error: `Máximo ${MAX_STAGES} etapas` };
  // Stages may run until the event's last day (multi-day events).
  const lastDay = opts.endDate || String(opts.eventDate || "").slice(0, 10);

  const clean: CleanStage[] = [];
  for (let i = 0; i < input.length; i++) {
    const raw = input[i] as Record<string, unknown> | null;
    const label = `Etapa ${i + 1}`;
    if (!raw || typeof raw !== "object") return { error: `${label}: datos inválidos` };

    let id: number | undefined;
    if (raw.id != null && raw.id !== "") {
      id = Number(raw.id);
      if (!Number.isInteger(id) || id <= 0) return { error: `${label}: id inválido` };
    }
    const name_es = str(raw.name_es, 80);
    if (!name_es) return { error: `${label}: el nombre (ES) es obligatorio` };

    const numeric = (v: unknown) =>
      typeof v === "number" || (typeof v === "string" && v.trim() !== "");
    const price = numeric(raw.price) ? Number(raw.price) : NaN;
    if (!Number.isInteger(price) || price < 0)
      return { error: `${label}: el precio debe ser un número entero mayor o igual a 0` };
    if (price > 0 && price < opts.minAmount)
      return { error: `${label}: el precio mínimo es ${opts.minAmount} COP (o 0 si es gratis)` };

    const capacity = numeric(raw.capacity) ? Number(raw.capacity) : NaN;
    if (!Number.isInteger(capacity) || capacity < 1)
      return { error: `${label}: el cupo debe ser al menos 1` };

    const starts_on = str(raw.starts_on, 10) ?? "";
    if (!isDate(starts_on)) return { error: `${label}: la fecha de inicio debe ser AAAA-MM-DD` };
    const endsRaw = str(raw.ends_on, 10);
    if (endsRaw != null && !isDate(endsRaw))
      return { error: `${label}: la fecha de fin debe ser AAAA-MM-DD` };
    if (endsRaw != null && endsRaw < starts_on)
      return { error: `${label}: termina antes de empezar` };
    if (lastDay && starts_on > lastDay)
      return { error: `${label}: empieza después del evento` };
    if (lastDay && endsRaw != null && endsRaw > lastDay)
      return { error: `${label}: termina después del evento` };

    clean.push({
      ...(id != null ? { id } : {}),
      name_es,
      name_en: str(raw.name_en, 80),
      name_fr: str(raw.name_fr, 80),
      price,
      capacity,
      starts_on,
      ends_on: endsRaw,
    });
  }

  const ids = clean.map((s) => s.id).filter((v) => v != null);
  if (new Set(ids).size !== ids.length) return { error: "Etapas repetidas" };

  clean.sort(byStart);
  for (let i = 0; i < clean.length - 1; i++) {
    const s = clean[i];
    if (s.ends_on == null)
      return { error: `«${s.name_es}»: solo la última etapa puede no tener fecha de fin` };
    if (s.ends_on >= clean[i + 1].starts_on)
      return { error: `«${s.name_es}» se cruza con «${clean[i + 1].name_es}»` };
  }
  return { stages: clean };
}
