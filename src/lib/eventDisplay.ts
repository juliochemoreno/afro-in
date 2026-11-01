// Display helpers for the public ticketing pages (events list, event page,
// tickets). Pure, no "@/" imports, so the tests can load it directly.
import type { Sale, StageView } from "./ticketStages.ts";

export function localeTag(lang: string): string {
  return lang === "en" ? "en-US" : lang === "fr" ? "fr-FR" : "es-CO";
}

// events.event_date is a Bogotá wall-clock string (YYYY-MM-DDTHH:MM). Read its
// parts as UTC and format them in UTC, so the runtime time zone never moves
// the day or the hour.
function wallClock(eventDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(eventDate);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0)));
}

// "ene." → "ene", narrow no-break spaces → plain spaces.
const tidy = (s: string) => s.replace(/\.$/, "").replace(/[  ]/g, " ");

/** Weekday, day and month for the gold calendar block. */
export function calParts(
  eventDate: string,
  lang: string
): { weekday: string; day: string; month: string } {
  const d = wallClock(eventDate);
  if (!d) return { weekday: "", day: "", month: "" };
  const tag = localeTag(lang);
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    tidy(d.toLocaleDateString(tag, { ...o, timeZone: "UTC" }));
  return {
    weekday: fmt({ weekday: "short" }),
    day: String(d.getUTCDate()),
    month: fmt({ month: "short" }),
  };
}

/** The event's start time, or null when the date has no time. */
export function eventTime(eventDate: string, lang: string): string | null {
  if (!/T\d{2}:\d{2}/.test(eventDate)) return null;
  const d = wallClock(eventDate)!;
  return tidy(
    d.toLocaleTimeString(localeTag(lang), { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
  );
}

/** "15 ene 2027": the event's day, short, in the page language. */
export function shortDate(eventDate: string, lang: string): string | null {
  const d = wallClock(eventDate);
  if (!d) return null;
  return d
    .toLocaleDateString(localeTag(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .replace(/[\u202f\u00a0]/g, " ");
}

export type CardStatus =
  | { kind: "soldout" }
  | { kind: "opens"; opensOn: string }
  | { kind: "stage"; stage: StageView }
  | { kind: "none" };

/** The flag an event card shows: sold out, sale not open yet, or the stage on sale. */
export function cardStatus(e: { soldOut: boolean; sale: Sale | null; stages: unknown[] }): CardStatus {
  if (e.soldOut) return { kind: "soldout" };
  if (e.sale?.state === "upcoming") return { kind: "opens", opensOn: e.sale.opensOn };
  if (e.sale?.state === "current" && e.stages.length > 0) return { kind: "stage", stage: e.sale.stage };
  return { kind: "none" };
}
