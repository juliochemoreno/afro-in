import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMainMenu, isPalenquePath, isPassSeason } from "../src/lib/mainMenu.ts";

test("isPassSeason covers 2026-11-01 to 2027-01-17 in Colombia time", () => {
  assert.equal(isPassSeason(new Date("2026-10-31T23:59:00-05:00")), false);
  assert.equal(isPassSeason(new Date("2026-11-01T00:00:00-05:00")), true);
  assert.equal(isPassSeason(new Date("2027-01-16T12:00:00-05:00")), true);
  assert.equal(isPassSeason(new Date("2027-01-17T23:59:00-05:00")), true);
  assert.equal(isPassSeason(new Date("2027-01-18T00:00:00-05:00")), false);
});

test("isPalenquePath matches es/en/fr palenque pages only", () => {
  assert.equal(isPalenquePath("/programacion/2027/palenque"), true);
  assert.equal(isPalenquePath("/en/program/2027/palenque/"), true);
  assert.equal(isPalenquePath("/fr/programme/2027/palenque"), true);
  assert.equal(isPalenquePath("/programacion/2027/santa-marta"), false);
  assert.equal(isPalenquePath("/programacion"), false);
});

test("buildMainMenu has 4 items, 3 Nosotros children and 7 footer links", () => {
  const m = buildMainMenu((k: string) => k, (p: string, l: string) => `/${l}${p}`, "es");
  assert.equal(m.items.length, 4);
  assert.equal(m.items[3].children?.length, 3);
  assert.equal(m.footerLinks.length, 7);
  assert.equal(m.passUrl, "/es/eventos/pase-afroin-2027-santa-marta");
});
