import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildBillingAddress,
  buildCustomerData,
} from "../src/lib/boldPrefill.ts";

test("customerData splits the stored phone into digits and dial code", () => {
  const data = JSON.parse(
    buildCustomerData({
      name: " Ana Pérez ",
      email: "ana@example.com ",
      phone: "+57 3001234567",
    })
  );
  assert.deepEqual(data, {
    fullName: "Ana Pérez",
    email: "ana@example.com",
    phone: "3001234567",
    dialCode: "+57",
  });
});

test("customerData omits an unparseable phone", () => {
  const data = JSON.parse(
    buildCustomerData({ name: "Ana", email: "a@b.co", phone: "300 123" })
  );
  assert.deepEqual(data, { fullName: "Ana", email: "a@b.co" });
});

test("billingAddress needs an alpha-2 country", () => {
  assert.equal(
    buildBillingAddress({ address: "x", city: "y", country: "Colombia" }),
    undefined
  );
  assert.deepEqual(
    JSON.parse(
      buildBillingAddress({
        address: "Calle 1 # 2-3",
        city: "Santa Marta",
        state: "Magdalena",
        country: "CO",
      })!
    ),
    {
      address: "Calle 1 # 2-3",
      city: "Santa Marta",
      state: "Magdalena",
      country: "CO",
    }
  );
});

test("billingAddress drops an empty state", () => {
  const data = JSON.parse(
    buildBillingAddress({ address: "a", city: "b", state: " ", country: "AW" })!
  );
  assert.equal("state" in data, false);
});
