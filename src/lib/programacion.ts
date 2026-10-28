// Pure helpers for the edition programming pages (tour2027 and later).
// Dates are ISO "YYYY-MM-DD" strings read as UTC so the day never shifts
// with the build machine's time zone (Bogotá is UTC-5).

export type Lang = "es" | "en" | "fr";

const LOCALES: Record<Lang, string> = { es: "es-CO", en: "en-US", fr: "fr-FR" };

// Language and slug come from the entry's file path ("santa-marta.en.md"):
// glob ids drop the dot ("santa-martaen"), which a slug ending in "en" would fool.
const FILE_PATTERN = /([^/]+?)(?:\.(en|fr))?\.mdx?$/;

export function entryLang(filePath: string): Lang {
  const match = FILE_PATTERN.exec(filePath);
  if (!match) throw new Error(`Unexpected content file: ${filePath}`);
  return (match[2] as Lang | undefined) ?? "es";
}

export function baseSlug(filePath: string): string {
  const match = FILE_PATTERN.exec(filePath);
  if (!match) throw new Error(`Unexpected content file: ${filePath}`);
  return match[1];
}

export function parseIsoDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`Invalid ISO date: ${iso}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function format(iso: string, lang: Lang, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { timeZone: "UTC", ...options }).format(
    parseIsoDate(iso)
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

export function dayLabel(iso: string, lang: Lang) {
  return {
    weekdayLong: capitalize(format(iso, lang, { weekday: "long" })),
    weekdayShort: capitalize(format(iso, lang, { weekday: "short" }).replace(/\.$/, "")),
    dayMonth: format(iso, lang, { day: "numeric", month: "long" }),
    dayNumber: String(parseIsoDate(iso).getUTCDate()),
  };
}

function withYearSuffix(text: string, year: number, lang: Lang): string {
  if (lang === "en") return `${text}, ${year}`;
  if (lang === "fr") return `${text} ${year}`;
  return `${text} de ${year}`;
}

// "15 – 17 de enero" / "January 15 – 17" / "15 – 17 janvier"; withYear adds
// the year, and a range across years always shows both.
export function dateRange(
  startIso: string,
  endIso: string,
  lang: Lang,
  { withYear = false } = {}
): string {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  if (startYear !== endYear) {
    const from = withYearSuffix(dayLabel(startIso, lang).dayMonth, startYear, lang);
    const to = withYearSuffix(dayLabel(endIso, lang).dayMonth, endYear, lang);
    return `${from} – ${to}`;
  }
  let text: string;
  if (start.getUTCMonth() !== end.getUTCMonth()) {
    text = `${dayLabel(startIso, lang).dayMonth} – ${dayLabel(endIso, lang).dayMonth}`;
  } else {
    const days = `${start.getUTCDate()} – ${end.getUTCDate()}`;
    const month = format(startIso, lang, { month: "long" });
    text = lang === "en" ? `${month} ${days}` : lang === "fr" ? `${days} ${month}` : `${days} de ${month}`;
  }
  return withYear ? withYearSuffix(text, startYear, lang) : text;
}

export function joinList(items: string[], lang: Lang): string {
  return new Intl.ListFormat(LOCALES[lang], { type: "conjunction" }).format(items);
}

export function formatCop(amount: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALES[lang], {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function isComingSoon(days: { activities: unknown[] }[]): boolean {
  return days.every((day) => day.activities.length === 0);
}

interface DayWithArtists {
  date: string;
  venue?: string;
  activities: { artist?: string | { id: string } }[];
}

// First day (in content order) with an activity by this artist.
export function firstAppearance(
  artistId: string,
  days: DayWithArtists[]
): { date: string; venue?: string } | undefined {
  const day = days.find((d) =>
    d.activities.some((a) => (typeof a.artist === "string" ? a.artist : a.artist?.id) === artistId)
  );
  return day ? { date: day.date, venue: day.venue } : undefined;
}

export interface StopForAppearances {
  slug: string;
  name: string;
  days: {
    date: string;
    venue?: string;
    activities: { title: string; artist?: string | { id: string } }[];
  }[];
}

// Every activity of an artist across the edition's stops, in content order.
export function artistAppearances(artistId: string, stops: StopForAppearances[]) {
  return stops.flatMap((stop) =>
    stop.days.flatMap((day) =>
      day.activities
        .filter((a) => (typeof a.artist === "string" ? a.artist : a.artist?.id) === artistId)
        .map((a) => ({ stopSlug: stop.slug, stopName: stop.name, date: day.date, venue: day.venue, title: a.title }))
    )
  );
}

// "CO" → 🇨🇴 (regional indicator symbols), like the site's language picker.
export function flagEmoji(countryCode: string): string {
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error(`Invalid country code: ${countryCode}`);
  return String.fromCodePoint(...[...countryCode].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// The edition day by day across stops (a date shared by two stops lists both),
// sorted by date then stop order. Used by the listing's journey section.
export function journeyDays<Stop extends { order: number; days: Day[] }, Day extends { date: string }>(
  stops: Stop[]
): { date: string; entries: { stop: Stop; day: Day }[] }[] {
  const byDate = new Map<string, { stop: Stop; day: Day }[]>();
  for (const stop of [...stops].sort((a, b) => a.order - b.order)) {
    for (const day of stop.days) {
      byDate.set(day.date, [...(byDate.get(day.date) ?? []), { stop, day }]);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => ({ date, entries }));
}
