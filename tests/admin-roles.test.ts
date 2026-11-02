import { test } from "node:test";
import assert from "node:assert/strict";
import { accountActive, parseRole, validActiveUntil } from "../src/lib/adminRoles.ts";

// A Bogotá wall-clock time as a UTC instant (Bogotá = UTC-5).
const bogota = (y: number, mo: number, d: number, h: number, mi = 0) =>
  Date.UTC(y, mo - 1, d, h + 5, mi);

test("parseRole keeps the known roles and never invents superadmin", () => {
  assert.equal(parseRole("superadmin"), "superadmin");
  assert.equal(parseRole("door"), "door");
  assert.equal(parseRole("admin"), "admin");
  assert.equal(parseRole("Door "), "door");
  assert.equal(parseRole("SuperAdmin"), "superadmin");
  assert.equal(parseRole("editor"), "admin");
  assert.equal(parseRole(null), "admin");
  assert.equal(parseRole(undefined), "admin");
});

test("admin and superadmin accounts never expire", () => {
  const now = bogota(2030, 1, 1, 12);
  assert.equal(accountActive({ role: "admin", active_until: null }, now), true);
  assert.equal(accountActive({ role: "superadmin", active_until: "2020-01-01" }, now), true);
});

test("a door account works until 06:00 Bogotá after its last day", () => {
  const door = { role: "door", active_until: "2027-01-17" };
  assert.equal(accountActive(door, bogota(2027, 1, 15, 20)), true);
  assert.equal(accountActive(door, bogota(2027, 1, 17, 23)), true);
  assert.equal(accountActive(door, bogota(2027, 1, 18, 5, 59)), true);
  assert.equal(accountActive(door, bogota(2027, 1, 18, 6, 0)), false);
  assert.equal(accountActive(door, bogota(2027, 2, 1, 12)), false);
});

test("a hand-edited door role still expires", () => {
  assert.equal(accountActive({ role: "Door ", active_until: "2027-01-17" }, bogota(2027, 2, 1, 12)), false);
});

test("a door account without a valid date is never active", () => {
  const now = bogota(2027, 1, 15, 20);
  for (const active_until of [null, undefined, "", "2027-1-17", "2027-02-30", "mañana"]) {
    assert.equal(accountActive({ role: "door", active_until }, now), false, String(active_until));
  }
});

test("validActiveUntil accepts today's door day or later, real dates only", () => {
  const now = bogota(2027, 1, 16, 2); // still the door day of Jan 15
  assert.equal(validActiveUntil("2027-01-15", now), "2027-01-15");
  assert.equal(validActiveUntil(" 2027-01-17 ", now), "2027-01-17");
  assert.equal(validActiveUntil("2027-01-14", now), null);
  assert.equal(validActiveUntil("2027-02-30", now), null);
  assert.equal(validActiveUntil("17/01/2027", now), null);
  assert.equal(validActiveUntil(20270117, now), null);
});
