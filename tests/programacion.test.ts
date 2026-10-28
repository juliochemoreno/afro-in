import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activityByline,
  artistAppearances,
  baseSlug,
  dateRange,
  dayLabel,
  entryLang,
  firstAppearance,
  flagEmoji,
  formatCop,
  isComingSoon,
  joinList,
  journeyDays,
  parseIsoDate,
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

test("date ranges in one month and across months", () => {
  assert.equal(dateRange("2027-01-15", "2027-01-17", "es"), "15 – 17 de enero");
  assert.equal(dateRange("2027-01-15", "2027-01-17", "en"), "January 15 – 17");
  assert.equal(dateRange("2027-01-15", "2027-01-17", "fr"), "15 – 17 janvier");
  assert.equal(dateRange("2027-01-30", "2027-02-02", "es"), "30 de enero – 2 de febrero");
  assert.equal(dateRange("2027-01-30", "2027-02-02", "en"), "January 30 – February 2");
});

test("date ranges with the year", () => {
  assert.equal(dateRange("2027-01-15", "2027-01-17", "es", { withYear: true }), "15 – 17 de enero de 2027");
  assert.equal(dateRange("2027-01-17", "2027-01-20", "en", { withYear: true }), "January 17 – 20, 2027");
  assert.equal(dateRange("2027-01-15", "2027-01-17", "fr", { withYear: true }), "15 – 17 janvier 2027");
  assert.equal(
    dateRange("2027-12-30", "2028-01-02", "es"),
    "30 de diciembre de 2027 – 2 de enero de 2028"
  );
});

test("lists join with the language's conjunction", () => {
  assert.equal(joinList(["A", "B", "C"], "es"), "A, B y C");
  assert.equal(joinList(["A", "B", "C"], "en"), "A, B, and C");
  assert.equal(joinList(["A", "B"], "fr"), "A et B");
});

test("COP prices have no decimals and use the language's grouping", () => {
  assert.match(formatCop(20000, "es"), /^\$\s?20\.000$/);
  assert.match(formatCop(45000, "en"), /45,000/);
  assert.match(formatCop(35000, "fr"), /35\s000/);
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
  assert.deepEqual(activityByline("Afro Batalla · Filtro", artist, "es"), { flag: "🇨🇴", byline: "Fafoman (Colombia)" });
  assert.deepEqual(activityByline("Fafoman", artist, "fr"), { flag: "🇨🇴", byline: "Colombie" });
  assert.deepEqual(activityByline("Fiesta", undefined, "es"), {});
});
