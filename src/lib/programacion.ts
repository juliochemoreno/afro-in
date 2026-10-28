// Pure helpers for the edition programming pages (tour2027 and later).
// Dates are ISO "YYYY-MM-DD" strings read as UTC so the day never shifts
// with the build machine's time zone (Bogotá is UTC-5).

export type Lang = "es" | "en" | "fr";

const LOCALES: Record<Lang, string> = { es: "es-CO", en: "en-US", fr: "fr-FR" };

// Glob ids of "santa-marta.en.md" end in "en" with or without the dot,
// same convention as the 2026 [slug].astro pages.
export function entryLang(id: string): Lang {
  if (id.endsWith("en")) return "en";
  if (id.endsWith("fr")) return "fr";
  return "es";
}

export function baseSlug(id: string): string {
  return id.replace(/\.?(en|fr)$/, "");
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

export function dateRange(startIso: string, endIso: string, lang: Lang): string {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (start.getUTCMonth() !== end.getUTCMonth()) {
    return `${dayLabel(startIso, lang).dayMonth} – ${dayLabel(endIso, lang).dayMonth}`;
  }
  const days = `${start.getUTCDate()} – ${end.getUTCDate()}`;
  const month = format(startIso, lang, { month: "long" });
  if (lang === "en") return `${month} ${days}`;
  if (lang === "fr") return `${days} ${month}`;
  return `${days} de ${month}`;
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
