import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calParts,
  cardStatus,
  eventTime,
  kickerDate,
  shortDate,
  shortDateRange,
} from "../src/lib/eventDisplay.ts";

const stage = {
  id: 2,
  event_id: 7,
  name_es: "Preventa 2",
  name_en: "Presale 2",
  name_fr: null,
  price: 35000,
  capacity: 150,
  starts_on: "2026-11-16",
  ends_on: "2026-12-16",
  sold: 0,
  held: 0,
  status: "current" as const,
  remaining: 150,
};

test("calParts reads the wall-clock date in each language", () => {
  assert.deepEqual(calParts("2027-01-15T20:00", "es"), { weekday: "vie", day: "15", month: "ene" });
  assert.deepEqual(calParts("2027-01-15T20:00", "en"), { weekday: "Fri", day: "15", month: "Jan" });
  assert.deepEqual(calParts("2027-01-15T20:00", "fr"), { weekday: "ven", day: "15", month: "janv" });
});

test("calParts never shifts the day with the runtime time zone", () => {
  assert.equal(calParts("2027-01-15T00:30", "es").day, "15");
  assert.equal(calParts("2027-01-15T23:59", "es").day, "15");
});

test("eventTime formats the wall-clock time", () => {
  assert.equal(eventTime("2027-01-15T20:00", "en"), "8:00 PM");
  assert.equal(eventTime("2027-01-15T20:00", "fr"), "20:00");
  assert.equal(eventTime("2027-01-15", "es"), null);
});

test("shortDate follows the page language, not the runtime", () => {
  assert.equal(shortDate("2027-01-15T00:30", "en"), "Jan 15, 2027");
  assert.equal(shortDate("2027-01-15T23:30", "fr"), "15 janv. 2027");
  assert.equal(shortDate("bad", "es"), null);
});

test("cardStatus: sold out wins", () => {
  assert.deepEqual(cardStatus({ soldOut: true, sale: { state: "ended" }, stages: [stage] }), {
    kind: "soldout",
  });
});

test("cardStatus: sale not open yet", () => {
  const s = cardStatus({
    soldOut: false,
    sale: { state: "upcoming", stage: { ...stage, status: "upcoming" }, opensOn: "2026-11-16" },
    stages: [stage],
  });
  assert.deepEqual(s, { kind: "opens", opensOn: "2026-11-16" });
});

test("cardStatus: current stage", () => {
  const s = cardStatus({
    soldOut: false,
    sale: { state: "current", stage, remaining: 150 },
    stages: [stage],
  });
  assert.equal(s.kind, "stage");
  assert.equal(s.kind === "stage" && s.stage.name_es, "Preventa 2");
});

test("cardStatus: single-price event", () => {
  assert.deepEqual(cardStatus({ soldOut: false, sale: null, stages: [] }), { kind: "none" });
});

// --- Multi-day events (D23) ---

test("calParts shows a multi-day event as ranges", () => {
  assert.deepEqual(calParts("2027-01-15T21:00", "es", "2027-01-17"), { weekday: "vie–dom", day: "15–17", month: "ene" });
  assert.deepEqual(calParts("2027-01-15T21:00", "en", "2027-01-17"), { weekday: "Fri–Sun", day: "15–17", month: "Jan" });
  assert.deepEqual(calParts("2027-01-15T21:00", "fr", "2027-01-17"), { weekday: "ven–dim", day: "15–17", month: "janv" });
  assert.deepEqual(calParts("2026-12-30T21:00", "es", "2027-01-01"), { weekday: "mié–vie", day: "30–1", month: "dic–ene" });
});

test("calParts ignores a missing, invalid or non-later last day", () => {
  const one = calParts("2027-01-15T21:00", "es");
  for (const end of [null, undefined, "", "2027-01-15", "2027-01-14", "17/01/2027", "2027-02-30"])
    assert.deepEqual(calParts("2027-01-15T21:00", "es", end), one, String(end));
});

test("kickerDate: one day, and ranges within a month, across months and years", () => {
  assert.equal(kickerDate("2026-12-20T20:00", "es"), "Dom 20 Dic 2026");
  assert.equal(kickerDate("2027-01-15T21:00", "es", "2027-01-17"), "Vie 15 – Dom 17 Ene 2027");
  assert.equal(kickerDate("2027-01-15T21:00", "en", "2027-01-17"), "Fri 15 – Sun 17 Jan 2027");
  assert.equal(kickerDate("2027-01-15T21:00", "fr", "2027-01-17"), "Ven 15 – Dim 17 Janv 2027");
  assert.equal(kickerDate("2027-01-29T21:00", "es", "2027-02-01"), "Vie 29 Ene – Lun 1 Feb 2027");
  assert.equal(kickerDate("2026-12-30T21:00", "es", "2027-01-01"), "Mié 30 Dic 2026 – Vie 1 Ene 2027");
  assert.equal(kickerDate("2027-01-15T21:00", "es", "2027-01-15"), "Vie 15 Ene 2027");
});

test("shortDateRange in each language", () => {
  assert.equal(shortDateRange("2027-01-15T21:00", "es", "2027-01-17"), "15–17 ene 2027");
  assert.equal(shortDateRange("2027-01-15T21:00", "en", "2027-01-17"), "Jan 15–17, 2027");
  assert.equal(shortDateRange("2027-01-15T21:00", "fr", "2027-01-17"), "15–17 janv 2027");
  assert.equal(shortDateRange("2027-01-29T21:00", "es", "2027-02-01"), "29 ene – 1 feb 2027");
  assert.equal(shortDateRange("2027-01-29T21:00", "en", "2027-02-01"), "Jan 29 – Feb 1, 2027");
  assert.equal(shortDateRange("2026-12-30T21:00", "es", "2027-01-01"), "30 dic 2026 – 1 ene 2027");
  assert.equal(shortDateRange("2026-12-30T21:00", "en", "2027-01-01"), "Dec 30, 2026 – Jan 1, 2027");
});

test("shortDateRange without a valid last day is shortDate", () => {
  for (const lang of ["es", "en", "fr"])
    for (const end of [null, "", "2027-01-15", "2027-01-10"])
      assert.equal(shortDateRange("2027-01-15T21:00", lang, end), shortDate("2027-01-15T21:00", lang));
});
