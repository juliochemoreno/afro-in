import { test } from "node:test";
import assert from "node:assert/strict";
import { doorDay, doorDayIndex, isMultiDay } from "../src/lib/doorDay.ts";

// A Bogotá wall-clock time as a UTC instant (Bogotá = UTC-5).
const bogota = (y: number, mo: number, d: number, h: number, mi = 0) =>
  Date.UTC(y, mo - 1, d, h + 5, mi);

const pase = { event_date: "2027-01-15T21:00", end_date: "2027-01-17" };

test("doorDay rolls over at 06:00 Bogotá", () => {
  assert.equal(doorDay(bogota(2027, 1, 15, 5, 59)), "2027-01-14");
  assert.equal(doorDay(bogota(2027, 1, 15, 6, 0)), "2027-01-15");
  assert.equal(doorDay(bogota(2027, 1, 15, 21, 0)), "2027-01-15");
  assert.equal(doorDay(bogota(2027, 1, 16, 1, 30)), "2027-01-15");
  assert.equal(doorDay(bogota(2027, 1, 18, 5, 59)), "2027-01-17");
  assert.equal(doorDay(bogota(2027, 1, 18, 6, 0)), "2027-01-18");
});

test("doorDay crosses month and year boundaries", () => {
  assert.equal(doorDay(bogota(2027, 1, 1, 3, 0)), "2026-12-31");
  assert.equal(doorDay(bogota(2027, 3, 1, 2, 0)), "2027-02-28");
});

test("isMultiDay needs an end date after the start date", () => {
  assert.equal(isMultiDay({ event_date: "2027-01-15T21:00", end_date: null }), false);
  assert.equal(isMultiDay({ event_date: "2027-01-15T21:00" }), false);
  assert.equal(isMultiDay({ event_date: "2027-01-15T21:00", end_date: "2027-01-15" }), false);
  assert.equal(isMultiDay(pase), true);
});

test("doorDayIndex numbers the days of the pass", () => {
  assert.equal(doorDayIndex(pase, "2027-01-14"), null);
  assert.deepEqual(doorDayIndex(pase, "2027-01-15"), { day: 1, days: 3 });
  assert.deepEqual(doorDayIndex(pase, "2027-01-16"), { day: 2, days: 3 });
  assert.deepEqual(doorDayIndex(pase, "2027-01-17"), { day: 3, days: 3 });
  assert.equal(doorDayIndex(pase, "2027-01-18"), null);
});

test("doorDayIndex is null for single-day events", () => {
  assert.equal(doorDayIndex({ event_date: "2027-01-15T21:00", end_date: null }, "2027-01-15"), null);
});

test("doorDayIndex across a year boundary", () => {
  const e = { event_date: "2026-12-31T22:00", end_date: "2027-01-02" };
  assert.deepEqual(doorDayIndex(e, "2026-12-31"), { day: 1, days: 3 });
  assert.deepEqual(doorDayIndex(e, "2027-01-01"), { day: 2, days: 3 });
  assert.deepEqual(doorDayIndex(e, "2027-01-02"), { day: 3, days: 3 });
});

test("a 01:30 scan on 16 Jan is day 1 of the pass", () => {
  assert.deepEqual(doorDayIndex(pase, doorDay(bogota(2027, 1, 16, 1, 30))), { day: 1, days: 3 });
});
