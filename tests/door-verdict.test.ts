import { test } from "node:test";
import assert from "node:assert/strict";
import { doorVerdict, type Verdict } from "../src/lib/doorVerdict.ts";

const cases: [Verdict, string, string][] = [
  [{ result: "ok", attendee: "Ana", eventName: "Pase 2027", day: 2, days: 3 }, "ok", "Puede entrar"],
  [{ result: "ok", attendee: "Ana", eventName: "Concierto" }, "ok", "Puede entrar"],
  [
    { result: "already", attendee: "Ana", eventName: "Pase", checkedInAt: "2027-01-16 02:30:00", today: true },
    "warn",
    "Ya entró hoy",
  ],
  [
    { result: "already", attendee: "Ana", eventName: "Concierto", checkedInAt: "2027-01-16 02:30:00" },
    "warn",
    "Entrada ya usada",
  ],
  [
    { result: "out_of_range", attendee: "Ana", eventName: "Pase", startDate: "2027-01-15", endDate: "2027-01-17" },
    "bad",
    "Fuera de fechas",
  ],
  [{ result: "not_found" }, "bad", "Entrada no encontrada"],
  [{ result: "not_paid" }, "bad", "Pago no confirmado"],
  [{ result: "error" }, "bad", "Sin conexión"],
  [{ result: "expired" }, "bad", "Sesión vencida"],
];

test("each result maps to its tone and title, with an explanation", () => {
  for (const [v, tone, title] of cases) {
    const view = doorVerdict(v);
    assert.equal(view.tone, tone, v.result);
    assert.equal(view.title, title, v.result);
    assert.ok(view.hint.length > 10, `${v.result} has no hint`);
    const texts = [view.title, ...view.lines, view.hint];
    assert.equal(new Set(texts).size, texts.length, `${v.result} repeats a text`);
  }
});

test("ok shows the name, the event and the door day of a multi-day pass", () => {
  assert.deepEqual(doorVerdict(cases[0][0]).lines, ["Ana", "Pase 2027 · día 2 de 3"]);
  assert.deepEqual(doorVerdict(cases[1][0]).lines, ["Ana", "Concierto"]);
});

test("already shows when it was used, in Bogotá time", () => {
  // 02:30 UTC on the 16th = 9:30 p. m. on the 15th in Bogotá
  assert.match(doorVerdict(cases[2][0]).lines[1], /^Entró a las 9:30/);
  assert.match(doorVerdict(cases[3][0]).lines[1], /^Se usó el 15 .* a las 9:30/);
});

test("out_of_range shows both pass dates", () => {
  const line = doorVerdict(cases[4][0]).lines[1];
  assert.match(line, /15/);
  assert.match(line, /17/);
});
