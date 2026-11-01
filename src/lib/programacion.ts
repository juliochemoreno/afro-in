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

// "enero" / "January" / "janvier": the month's name, for the sticky day bar.
export function monthName(iso: string, lang: Lang): string {
  return format(iso, lang, { month: "long" });
}

// "15 y 16 ene" / "Jan 15 & 16" / "15 et 16 janv": the days of one month, or the short
// dates joined when they span months. `dates` are ISO dates.
export function shortDateList(dates: string[], lang: Lang): string {
  const days = [...new Set(dates)].sort();
  if (days.length === 0) return "";
  const joiner = lang === "en" ? " & " : lang === "fr" ? " et " : " y ";
  const join = (items: string[]) =>
    items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")}${joiner}${items[items.length - 1]}`;
  const short = (iso: string) => format(iso, lang, { day: "numeric", month: "short" }).replace(/\.$/, "").replace(/^(\d+) de /, "$1 ");
  const months = new Set(days.map((iso) => iso.slice(0, 7)));
  if (months.size > 1) return join(days.map(short));
  const numbers = days.map((iso) => String(parseIsoDate(iso).getUTCDate()));
  const month = short(days[0]).replace(/\d+\s*/, "").trim();
  return lang === "en" ? `${month} ${join(numbers)}` : `${join(numbers)} ${month}`;
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
    return rangeOf(from, to, lang);
  }
  let text: string;
  if (start.getUTCMonth() !== end.getUTCMonth()) {
    text = rangeOf(dayLabel(startIso, lang).dayMonth, dayLabel(endIso, lang).dayMonth, lang);
  } else {
    const month = format(startIso, lang, { month: "long" });
    const [from, to] = [start.getUTCDate(), end.getUTCDate()];
    // "15 al 17 de enero" / "January 15–17" / "du 15 au 17 janvier"
    text = lang === "en" ? `${month} ${from}–${to}` : lang === "fr" ? `du ${from} au ${to} ${month}` : `${from} al ${to} de ${month}`;
  }
  return withYear ? withYearSuffix(text, startYear, lang) : text;
}

// "<from> al <to>" / "<from> – <to>" / "du <from> au <to>" for two full dates.
function rangeOf(from: string, to: string, lang: Lang): string {
  return lang === "en" ? `${from} – ${to}` : lang === "fr" ? `du ${from} au ${to}` : `${from} al ${to}`;
}

export function joinList(items: string[], lang: Lang): string {
  return new Intl.ListFormat(LOCALES[lang], { type: "conjunction" }).format(items);
}

// Buy pages of the ticketing system's events. Fill in each `url` (an afroin.org
// path such as "/eventos/<slug>"): `tickets` turns the "soon" button of the
// current price stage into a link, `afroBatalla` gives the Afro Batalla
// activities their sign-up button (see activitySignup.ts).
export const SALES = {
  tickets: { url: "/eventos/pase-afroin-2027-santa-marta" },
  afroBatalla: { price: 30000, url: "" },
};

export type TierStage = "upcoming" | "current" | "past";

// Stage of a price tier on `today` (ISO date in Bogotá time); `from` and
// `until` are inclusive and either may be missing.
export function tierStage(today: string, from?: string, until?: string): TierStage {
  if (from && today < from) return "upcoming";
  if (until && today > until) return "past";
  return "current";
}

// Today's ISO date in Bogotá (UTC-5, no daylight saving).
export function bogotaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(now);
}

export function formatCop(amount: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALES[lang], {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

// Anchor of a day on its stop page; the full date keeps ids unique even when
// a stop spans two months.
export function dayAnchor(iso: string): string {
  parseIsoDate(iso);
  return `d-${iso}`;
}

function artistIdOf(artist: string | { id: string } | undefined): string | undefined {
  return typeof artist === "string" ? artist : artist?.id;
}

// The artists of an activity: its artist, its co-artist and any more, in that order.
export function activityArtistIds(activity: {
  artist?: string | { id: string };
  coArtist?: string | { id: string };
  moreArtists?: (string | { id: string })[];
}): string[] {
  return [artistIdOf(activity.artist), artistIdOf(activity.coArtist), ...(activity.moreArtists ?? []).map(artistIdOf)].filter(
    (id): id is string => !!id
  );
}

export function isComingSoon(days: { activities: unknown[] }[]): boolean {
  return days.every((day) => day.activities.length === 0);
}

interface DayWithArtists {
  date: string;
  venue?: string;
  activities: { artist?: string | { id: string }; coArtist?: string | { id: string }; moreArtists?: (string | { id: string })[] }[];
}

// First day (in content order) with an activity by this artist.
export function firstAppearance(
  artistId: string,
  days: DayWithArtists[]
): { date: string; venue?: string } | undefined {
  const day = days.find((d) =>
    d.activities.some((a) => activityArtistIds(a).includes(artistId))
  );
  return day ? { date: day.date, venue: day.venue } : undefined;
}

type BylineArtist = { name: string; countryCode?: string; country?: Record<Lang, string> };

// One byline per artist of an activity (see activityByline), for the agenda rows.
export function artistLines(
  title: string,
  artists: (BylineArtist | undefined)[],
  lang: Lang
): { countryCode?: string; countryName?: string; byline: string }[] {
  return artists.flatMap((artist) => {
    const line = activityByline(title, artist, lang);
    return line.byline ? [{ countryCode: line.countryCode, countryName: line.countryName, byline: line.byline }] : [];
  });
}

export interface StopForAppearances {
  slug: string;
  name: string;
  days: {
    date: string;
    venue?: string;
    activities: {
      title: string;
      artist?: string | { id: string };
      coArtist?: string | { id: string };
      moreArtists?: (string | { id: string })[];
    }[];
  }[];
}

// Every activity of an artist across the edition's stops, in content order.
export function artistAppearances(artistId: string, stops: StopForAppearances[]) {
  return stops.flatMap((stop) =>
    stop.days.flatMap((day) =>
      day.activities
        .filter((a) => activityArtistIds(a).includes(artistId))
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

// Artist line under an activity: the country when the title already names
// the artist ("Chichi Banana"), else "Name (Country)".
export function activityByline(
  title: string,
  artist: { name: string; countryCode?: string; country?: Record<Lang, string> } | undefined,
  lang: Lang
): { countryCode?: string; countryName?: string; byline?: string } {
  if (!artist) return {};
  const countryName = artist.country?.[lang];
  const named = title.includes(artist.name);
  return {
    countryCode: artist.countryCode,
    countryName,
    // Without a known country the line is just the name (nothing to add when the title has it).
    byline: countryName ? (named ? countryName : `${artist.name} (${countryName})`) : named ? undefined : artist.name,
  };
}

// The current day of the journey: the topmost one that still has content below the line
// (the bottom edge of the site header and the sticky day bar). The next day takes over only
// once the previous one is completely out of view, and scrolling up the previous one takes
// over as soon as any of it reappears. The photo and the bar both follow this one index.
export function activeDayIndex(bottoms: number[], line: number): number {
  const index = bottoms.findIndex((bottom) => bottom > line);
  return index === -1 ? Math.max(bottoms.length - 1, 0) : index;
}

// Where a stop is, from its "City, Department" location: the department alone when the
// city is the stop's own name ("Santa Marta" → "Magdalena"), else the whole place
// ("San Basilio de Palenque, Bolívar").
export function stopPlace(location: string, stopName: string): string {
  const [city, department] = location.split(",").map((part) => part.trim());
  return department && city === stopName ? department : location;
}
