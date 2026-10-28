import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baseSlug,
  dateRange,
  dayLabel,
  entryLang,
  firstAppearance,
  formatCop,
  isComingSoon,
  joinList,
  parseIsoDate,
} from "../src/lib/programacion.ts";

test("entry language and slug accept ids with or without the dot", () => {
  assert.equal(entryLang("santa-marta"), "es");
  assert.equal(entryLang("santa-marta.en"), "en");
  assert.equal(entryLang("santa-martaen"), "en");
  assert.equal(entryLang("palenque.fr"), "fr");
  assert.equal(baseSlug("santa-marta.en"), "santa-marta");
  assert.equal(baseSlug("palenquefr"), "palenque");
  assert.equal(baseSlug("palenque"), "palenque");
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
