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

// One part of a wall-clock date ("vie", "ene", "2027") in the page language.
function part(d: Date, lang: string, o: Intl.DateTimeFormatOptions): string {
  return tidy(d.toLocaleDateString(localeTag(lang), { ...o, timeZone: "UTC" }));
}

// A multi-day event's last day, only when it is a valid day after the start.
function lastDay(start: Date, endDate?: string | null): Date | null {
  if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
  const end = wallClock(endDate);
  if (!end || end.toISOString().slice(0, 10) !== endDate) return null;
  return end.getTime() > Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
    ? end
    : null;
}

const sameMonth = (a: Date, b: Date) =>
  a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();

/** Weekday, day and month for the gold calendar block (the start day). */
export function calParts(
  eventDate: string,
  lang: string
): { weekday: string; day: string; month: string } {
  const d = wallClock(eventDate);
  if (!d) return { weekday: "", day: "", month: "" };
  return {
    weekday: part(d, lang, { weekday: "short" }),
    day: String(d.getUTCDate()),
    month: part(d, lang, { month: "short" }),
  };
}

/**
 * A multi-day event's last day for the event cards, next to the start day's
 * gold block: "Hasta dom 17" / "Until Sun 17" / "Jusqu'au dim 17", with the
 * month when it changes ("Hasta lun 1 feb"). Null for a one-day event.
 */
export function untilDate(eventDate: string, lang: string, endDate?: string | null): string | null {
  const d = wallClock(eventDate);
  if (!d) return null;
  const last = lastDay(d, endDate);
  if (!last) return null;
  let day = `${part(last, lang, { weekday: "short" })} ${last.getUTCDate()}`;
  if (!sameMonth(d, last)) day += ` ${part(last, lang, { month: "short" })}`;
  return lang === "en" ? `Until ${day}` : lang === "fr" ? `Jusqu'au ${day}` : `Hasta ${day}`;
}

/**
 * The date over the event page title: "Dom 20 Dic 2026", or for a multi-day
 * event "Vie 15 – Dom 17 Ene 2027" (each date in full across months or years).
 */
export function kickerDate(eventDate: string, lang: string, endDate?: string | null): string {
  const d = wallClock(eventDate);
  if (!d) return "";
  const cap = (w: string) => w.replace(/^./, (c) => c.toUpperCase());
  const wdDay = (x: Date) => `${cap(part(x, lang, { weekday: "short" }))} ${x.getUTCDate()}`;
  const month = (x: Date) => cap(part(x, lang, { month: "short" }));
  const year = (x: Date) => String(x.getUTCFullYear());
  const last = lastDay(d, endDate);
  if (!last) return `${wdDay(d)} ${month(d)} ${year(d)}`;
  if (sameMonth(d, last)) return `${wdDay(d)} – ${wdDay(last)} ${month(d)} ${year(d)}`;
  if (d.getUTCFullYear() === last.getUTCFullYear())
    return `${wdDay(d)} ${month(d)} – ${wdDay(last)} ${month(last)} ${year(d)}`;
  return `${wdDay(d)} ${month(d)} ${year(d)} – ${wdDay(last)} ${month(last)} ${year(last)}`;
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

/**
 * shortDate for an event that may last several days: "15–17 ene 2027" /
 * "Jan 15–17, 2027" / "15–17 janv 2027"; across months "29 ene – 1 feb 2027",
 * across years "30 dic 2026 – 1 ene 2027".
 * Without a valid last day it is shortDate.
 */
export function shortDateRange(
  eventDate: string,
  lang: string,
  endDate?: string | null
): string | null {
  const d = wallClock(eventDate);
  if (!d) return null;
  const last = lastDay(d, endDate);
  if (!last) return shortDate(eventDate, lang);
  const en = lang === "en";
  const mon = (x: Date) => part(x, lang, { month: "short" });
  const dm = (x: Date) => (en ? `${mon(x)} ${x.getUTCDate()}` : `${x.getUTCDate()} ${mon(x)}`);
  const year = d.getUTCFullYear();
  const endYear = last.getUTCFullYear();
  if (year !== endYear)
    return en
      ? `${dm(d)}, ${year} – ${dm(last)}, ${endYear}`
      : `${dm(d)} ${year} – ${dm(last)} ${endYear}`;
  if (sameMonth(d, last)) {
    const days = `${d.getUTCDate()}–${last.getUTCDate()}`;
    return en ? `${mon(d)} ${days}, ${year}` : `${days} ${mon(d)} ${year}`;
  }
  return en ? `${dm(d)} – ${dm(last)}, ${year}` : `${dm(d)} – ${dm(last)} ${year}`;
}

/**
 * How many days a multi-day event lasts, both ends included (15–17 ene = 3),
 * with its label: { n: 3, label: "días" }. Null for a one-day event.
 */
export function eventDays(
  eventDate: string,
  lang: string,
  endDate?: string | null
): { n: number; label: string } | null {
  const d = wallClock(eventDate);
  if (!d) return null;
  const last = lastDay(d, endDate);
  if (!last) return null;
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const n = Math.round((last.getTime() - start) / 86_400_000) + 1;
  return { n, label: lang === "en" ? "days" : lang === "fr" ? "jours" : "días" };
}
