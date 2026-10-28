import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatPhone,
  isValidEmail,
  isValidPhone,
  normalizeDigits,
  normalizeStoredPhone,
  parsePhone,
} from "../src/lib/checkoutFields.ts";

test("Colombian phones need exactly 10 digits", () => {
  assert.equal(isValidPhone("+57", "3001234567"), true);
  assert.equal(isValidPhone("+57", "6015551234"), true);
  assert.equal(isValidPhone("+57", "300123456"), false);
  assert.equal(isValidPhone("+57", "30012345678"), false);
});

test("other dial codes accept 4 to 14 digits", () => {
  assert.equal(isValidPhone("+1", "2025550123"), true);
  assert.equal(isValidPhone("+44", "1234"), true);
  assert.equal(isValidPhone("+44", "123"), false);
  assert.equal(isValidPhone("+44", "123456789012345"), false);
});

test("rejects malformed dial codes and non-digits", () => {
  assert.equal(isValidPhone("57", "3001234567"), false);
  assert.equal(isValidPhone("+12345", "3001234567"), false);
  assert.equal(isValidPhone("+57", "300 123 4567"), false);
});

test("normalizeDigits strips everything but digits", () => {
  assert.equal(normalizeDigits("(300) 123-45 67"), "3001234567");
  assert.equal(normalizeDigits("abc"), "");
});

test("format and parse round-trip", () => {
  const stored = formatPhone("+57", "3001234567");
  assert.equal(stored, "+57 3001234567");
  assert.deepEqual(parsePhone(stored), {
    dialCode: "+57",
    national: "3001234567",
  });
  assert.equal(parsePhone("3001234567"), null);
  assert.equal(parsePhone(null), null);
});

test("normalizeStoredPhone validates the stored format", () => {
  assert.equal(normalizeStoredPhone(" +57 3001234567 "), "+57 3001234567");
  assert.equal(normalizeStoredPhone("+57 300"), null);
  assert.equal(normalizeStoredPhone("+57 300 123 4567"), null);
  assert.equal(normalizeStoredPhone(undefined), null);
});

test("email", () => {
  assert.equal(isValidEmail(" a@b.co "), true);
  assert.equal(isValidEmail("a@b"), false);
});
