import { test } from "node:test";
import assert from "node:assert/strict";
import { doorVerdict, type Verdict } from "../src/lib/doorVerdict.ts";

const cases: [Verdict, string, string][] = [
  [{ result: "ok", attendee: "Ana", eventName: "Pase 2027", day: 2, days: 3 }, "ok", "Ana"],
  [{ result: "ok", attendee: "Ana", eventName: "Concierto" }, "ok", "Ana"],
  [
    { result: "already", attendee: "Ana", eventName: "Pase", checkedInAt: "2027-01-16 02:30:00", today: true },
    "warn",
    "Ya entró hoy",
  ],
  [
    { result: "already", attendee: "Ana", eventName: "Concierto", checkedInAt: "2027-01-16 02:30:00" },
    "warn",
    "Ya usada",
  ],
  [
    { result: "out_of_range", attendee: "Ana", eventName: "Pase", startDate: "2027-01-15", endDate: "2027-01-17" },
    "bad",
    "Fuera de fechas",
  ],
  [{ result: "not_found" }, "bad", "No encontrada"],
  [{ result: "not_paid" }, "bad", "Pago no confirmado"],
  [{ result: "error" }, "bad", "Error de red"],
  [{ result: "expired" }, "bad", "Sesión vencida"],
];

test("each result maps to its tone and title", () => {
  for (const [v, tone, title] of cases) {
    const view = doorVerdict(v);
    assert.equal(view.tone, tone, v.result);
    assert.equal(view.title, title, v.result);
    assert.notEqual(view.detail, view.title, `${v.result} repeats its title`);
  }
});

test("ok shows the door day of a multi-day pass, else the event name", () => {
  assert.equal(doorVerdict(cases[0][0]).detail, "Válida · día 2 de 3");
  assert.equal(doorVerdict(cases[1][0]).detail, "Concierto");
});

test("already shows the name and the Bogotá time", () => {
  // 02:30 UTC = 9:30 p. m. Bogotá
  assert.match(doorVerdict(cases[2][0]).detail ?? "", /^Ana · a las 9:30/);
  assert.match(doorVerdict(cases[3][0]).detail ?? "", /^Ana · 9:30/);
});

test("out_of_range shows both pass dates", () => {
  const detail = doorVerdict(cases[4][0]).detail ?? "";
  assert.match(detail, /15/);
  assert.match(detail, /17/);
});
