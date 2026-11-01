import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activityByline,
  artistAppearances,
  baseSlug,
  dateRange,
  dayAnchor,
  dayLabel,
  monthName,
  activeDayIndex,
  stopPlace,
  shortDateList,
  entryLang,
  firstAppearance,
  flagEmoji,
  formatCop,
  isComingSoon,
  joinList,
  journeyDays,
  parseIsoDate,
  SALES,
  bogotaToday,
  tierStage,
} from "../src/lib/programacion.ts";

test("entry language and slug come from the file path", () => {
  assert.equal(entryLang("src/content/tour2027/santa-marta.md"), "es");
  assert.equal(entryLang("src/content/tour2027/santa-marta.en.md"), "en");
  assert.equal(entryLang("src/content/tour2027/palenque.fr.mdx"), "fr");
  assert.equal(baseSlug("src/content/tour2027/santa-marta.en.md"), "santa-marta");
  assert.equal(baseSlug("src/content/tour2027/palenque.md"), "palenque");
  // A Spanish slug ending in "en" stays Spanish and whole.
  assert.equal(entryLang("src/content/tour2027/carmen.md"), "es");
  assert.equal(baseSlug("src/content/tour2027/carmen.md"), "carmen");
  assert.throws(() => entryLang("src/content/tour2027/readme.txt"));
});

test("ISO dates are read as UTC midnight", () => {
  assert.equal(parseIsoDate("2027-01-15").toISOString(), "2027-01-15T00:00:00.000Z");
  assert.throws(() => parseIsoDate("15/01/2027"));
  assert.throws(() => parseIsoDate("2027-1-15"));
});

test("day labels per language", () => {
  assert.deepEqual(dayLabel("2027-01-15", "es"), {
    weekdayLong: "Viernes",
    weekdayShort: "Vie",
    dayMonth: "15 de enero",
    dayNumber: "15",
  });
  assert.deepEqual(dayLabel("2027-01-15", "en"), {
    weekdayLong: "Friday",
    weekdayShort: "Fri",
    dayMonth: "January 15",
    dayNumber: "15",
  });
  assert.deepEqual(dayLabel("2027-01-15", "fr"), {
    weekdayLong: "Vendredi",
    weekdayShort: "Ven",
    dayMonth: "15 janvier",
    dayNumber: "15",
  });
});

test("month names for the sticky bar", () => {
  assert.equal(monthName("2027-01-15", "es"), "enero");
  assert.equal(monthName("2027-01-15", "en"), "January");
  assert.equal(monthName("2027-01-15", "fr"), "janvier");
});

test("short date lists for the artist cards", () => {
  assert.equal(shortDateList(["2027-01-16"], "es"), "16 ene");
  assert.equal(shortDateList(["2027-01-16", "2027-01-15"], "es"), "15 y 16 ene");
  assert.equal(shortDateList(["2027-01-15", "2027-01-16", "2027-01-17"], "es"), "15, 16 y 17 ene");
  assert.equal(shortDateList(["2027-01-15", "2027-01-16"], "en"), "Jan 15 & 16");
  assert.equal(shortDateList(["2027-01-15", "2027-01-16"], "fr"), "15 et 16 janv");
  assert.equal(shortDateList(["2027-01-31", "2027-02-01"], "es"), "31 ene y 1 feb");
});

test("date ranges in one month and across months", () => {
  assert.equal(dateRange("2027-01-15", "2027-01-17", "es"), "15 al 17 de enero");
  assert.equal(dateRange("2027-01-15", "2027-01-17", "en"), "January 15–17");
  assert.equal(dateRange("2027-01-15", "2027-01-17", "fr"), "du 15 au 17 janvier");
  assert.equal(dateRange("2027-01-30", "2027-02-02", "es"), "30 de enero al 2 de febrero");
  assert.equal(dateRange("2027-01-30", "2027-02-02", "en"), "January 30 – February 2");
  assert.equal(dateRange("2027-01-30", "2027-02-02", "fr"), "du 30 janvier au 2 février");
});

test("date ranges with the year", () => {
  assert.equal(dateRange("2027-01-15", "2027-01-17", "es", { withYear: true }), "15 al 17 de enero de 2027");
  assert.equal(dateRange("2027-01-17", "2027-01-20", "en", { withYear: true }), "January 17–20, 2027");
  assert.equal(dateRange("2027-01-15", "2027-01-17", "fr", { withYear: true }), "du 15 au 17 janvier 2027");
  assert.equal(
    dateRange("2027-12-30", "2028-01-02", "es"),
    "30 de diciembre de 2027 al 2 de enero de 2028"
  );
});

test("lists join with the language's conjunction", () => {
  assert.equal(joinList(["A", "B", "C"], "es"), "A, B y C");
  assert.equal(joinList(["A", "B", "C"], "en"), "A, B, and C");
  assert.equal(joinList(["A", "B"], "fr"), "A et B");
});

test("COP prices have no decimals and use the language's grouping", () => {
  assert.equal(formatCop(20000, "es"), "$20.000\u00a0COP");
  assert.equal(formatCop(45000, "en"), "$45,000\u00a0COP");
  assert.match(formatCop(35000, "fr"), /^\$35\s000\u00a0COP$/);
});

test("a stop is coming soon when no day has activities", () => {
  assert.equal(isComingSoon([]), true);
  assert.equal(isComingSoon([{ activities: [] }, { activities: [] }]), true);
  assert.equal(isComingSoon([{ activities: [] }, { activities: [{}] }]), false);
});

test("first appearance finds the first day referencing the artist", () => {
  const days = [
    { date: "2027-01-15", venue: "La Puerta", activities: [] },
    { date: "2027-01-16", venue: "Co·KoA", activities: [{ artist: { id: "robe" } }] },
    { date: "2027-01-17", venue: "Masaya", activities: [{ artist: "robe" }, { artist: "choco" }] },
  ];
  assert.deepEqual(firstAppearance("robe", days), { date: "2027-01-16", venue: "Co·KoA" });
  assert.deepEqual(firstAppearance("choco", days), { date: "2027-01-17", venue: "Masaya" });
  assert.equal(firstAppearance("eirini", days), undefined);
});

test("artist appearances list every activity across stops", () => {
  const stops = [
    {
      slug: "santa-marta",
      name: "Santa Marta",
      days: [
        { date: "2027-01-16", venue: "Co·KoA", activities: [{ title: "Show", artist: { id: "robe" } }] },
        { date: "2027-01-17", venue: "Masaya", activities: [{ title: "Clases", artist: "robe" }, { title: "Choco", artist: "choco" }] },
      ],
    },
    { slug: "palenque", name: "Palenque", days: [{ date: "2027-01-18", activities: [{ title: "Clases" }] }] },
  ];
  assert.deepEqual(artistAppearances("robe", stops), [
    { stopSlug: "santa-marta", stopName: "Santa Marta", date: "2027-01-16", venue: "Co·KoA", title: "Show" },
    { stopSlug: "santa-marta", stopName: "Santa Marta", date: "2027-01-17", venue: "Masaya", title: "Clases" },
  ]);
  assert.deepEqual(artistAppearances("eirini", stops), []);
});

test("country codes become flag emoji", () => {
  assert.equal(flagEmoji("CO"), "🇨🇴");
  assert.equal(flagEmoji("GB"), "🇬🇧");
  assert.throws(() => flagEmoji("co"));
});

test("journey merges stops day by day", () => {
  const santaMarta = { order: 1, days: [{ date: "2027-01-16" }, { date: "2027-01-17" }] };
  const palenque = { order: 2, days: [{ date: "2027-01-17" }, { date: "2027-01-18" }] };
  const journey = journeyDays([palenque, santaMarta]);
  assert.deepEqual(journey.map((d) => d.date), ["2027-01-16", "2027-01-17", "2027-01-18"]);
  assert.deepEqual(journey[1].entries.map((e) => e.stop.order), [1, 2]);
});

test("activity byline names the artist only when the title does not", () => {
  const artist = { name: "Fafoman", countryCode: "CO", country: { es: "Colombia", en: "Colombia", fr: "Colombie" } };
  assert.deepEqual(activityByline("Afro Batalla · Filtro", artist, "es"), { countryCode: "CO", countryName: "Colombia", byline: "Fafoman (Colombia)" });
  assert.deepEqual(activityByline("Fafoman", artist, "fr"), { countryCode: "CO", countryName: "Colombie", byline: "Colombie" });
  // No country yet: just the name, and nothing to add when the title already has it.
  const unknown = { name: "Afroneto" };
  assert.deepEqual(activityByline("Podcast", unknown, "es"), { countryCode: undefined, countryName: undefined, byline: "Afroneto" });
  assert.equal(activityByline("Afroneto en vivo", unknown, "es").byline, undefined);
  assert.deepEqual(activityByline("Fiesta", undefined, "es"), {});
});

test("day anchors use the full date", () => {
  assert.equal(dayAnchor("2027-01-16"), "d-2027-01-16");
  assert.throws(() => dayAnchor("16"));
});

test("sales config keeps the Afro Batalla price, with every link a site path or empty", () => {
  assert.equal(SALES.afroBatalla.price, 30000);
  for (const { url } of [SALES.tickets, SALES.afroBatalla]) {
    assert.match(url, /^(\/eventos\/[a-z0-9-]+)?$/);
  }
});

test("price stages follow the date, with open ends and inclusive limits", () => {
  const stages = [
    ["2026-11-01", "2026-11-15"],
    ["2026-11-16", "2026-12-16"],
    ["2026-12-17", undefined],
  ] as const;
  const at = (today: string) => stages.map(([from, until]) => tierStage(today, from, until));
  assert.deepEqual(at("2026-10-31"), ["upcoming", "upcoming", "upcoming"]);
  assert.deepEqual(at("2026-11-01"), ["current", "upcoming", "upcoming"]);
  assert.deepEqual(at("2026-11-15"), ["current", "upcoming", "upcoming"]);
  assert.deepEqual(at("2026-11-16"), ["past", "current", "upcoming"]);
  assert.deepEqual(at("2026-12-17"), ["past", "past", "current"]);
  assert.deepEqual(at("2027-01-20"), ["past", "past", "current"]);
});

test("Bogotá date does not move with UTC midnight", () => {
  // 03:00 UTC on Nov 1 is still Oct 31 in Bogotá (UTC-5).
  assert.equal(bogotaToday(new Date("2026-11-01T03:00:00Z")), "2026-10-31");
  assert.equal(bogotaToday(new Date("2026-11-01T05:00:00Z")), "2026-11-01");
});

test("the active day is the topmost one with content still below the sticky bar", () => {
  const line = 150;
  assert.equal(activeDayIndex([700, 1300, 1900], line), 0); // the first day on screen
  assert.equal(activeDayIndex([151, 800, 1400], line), 0); // one pixel of it still shows
  assert.equal(activeDayIndex([150, 800, 1400], line), 1); // completely above: the next takes over
  assert.equal(activeDayIndex([-500, 120, 700], line), 2); // day 2 is out of view too
  assert.equal(activeDayIndex([-900, -300, -10], line), 2); // past the end: the last stays
  assert.equal(activeDayIndex([], line), 0);
});

test("stop place: the department when the city is the stop's name, else the whole location", () => {
  assert.equal(stopPlace("Santa Marta, Magdalena", "Santa Marta"), "Magdalena");
  assert.equal(stopPlace("San Basilio de Palenque, Bolívar", "Palenque de Benkos"), "San Basilio de Palenque, Bolívar");
});
