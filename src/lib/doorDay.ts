// Door days for multi-day events (D25). A pass is valid once per door day from
// the date of event_date to end_date. The door day rolls over at 06:00 Bogotá,
// so a night that runs past midnight still counts as the day it started.
// Pure, no "@/" imports, so the tests can load it directly.

export const DOOR_DAY_ROLLOVER_HOUR = 6;

// Colombia is UTC-5 all year (no daylight saving), as in ticketStages.ts.
const BOGOTA_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The Bogotá door day (YYYY-MM-DD) at `now`. */
export function doorDay(now: number = Date.now()): string {
  const shift = BOGOTA_UTC_OFFSET_MS + DOOR_DAY_ROLLOVER_HOUR * 60 * 60 * 1000;
  return new Date(now - shift).toISOString().slice(0, 10);
}

type EventDates = { event_date: string; end_date?: string | null };

/** An event whose last day is after its start date. */
export function isMultiDay(e: EventDates): boolean {
  return !!e.end_date && e.end_date > e.event_date.slice(0, 10);
}

function dayNumber(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** Which day of a multi-day event `day` is (1-based), or null outside it. */
export function doorDayIndex(
  e: EventDates,
  day: string
): { day: number; days: number } | null {
  if (!isMultiDay(e)) return null;
  const start = e.event_date.slice(0, 10);
  const end = e.end_date as string;
  if (day < start || day > end) return null;
  return {
    day: dayNumber(day) - dayNumber(start) + 1,
    days: dayNumber(end) - dayNumber(start) + 1,
  };
}
