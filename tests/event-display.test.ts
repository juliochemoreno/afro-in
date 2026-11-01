import { test } from "node:test";
import assert from "node:assert/strict";
import { calParts, cardStatus, eventTime } from "../src/lib/eventDisplay.ts";

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
