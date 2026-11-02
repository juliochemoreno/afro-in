import { test } from "node:test";
import assert from "node:assert/strict";
import { orderRef } from "../src/lib/orderRef.ts";

test("orderRef: 8 upper-case characters of the random UUID, no row id", () => {
  assert.equal(orderRef("AFROIN-TIX-194b5443-e589-4888-9723-085aaf487850"), "194B5443");
  assert.equal(orderRef("AFROIN-ORD-0a1b2c3d-0000-4000-8000-000000000000"), "0A1B2C3D");
});
