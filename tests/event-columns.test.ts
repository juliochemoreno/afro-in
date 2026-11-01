import { test } from "node:test";
import assert from "node:assert/strict";
import { EVENT_COLUMNS, eventUpdate, eventValues } from "../src/lib/eventColumns.ts";

const body = {
  slug: "pase",
  name_es: "Pase",
  event_date: "2027-01-15T21:00",
  price: 20000,
  capacity: 350,
  visible: true,
};

test("values follow the column order", () => {
  const values = eventValues({ ...body, end_date: "2027-01-17" });
  assert.equal(values.length, EVENT_COLUMNS.length);
  assert.equal(values[EVENT_COLUMNS.indexOf("event_date")], "2027-01-15T21:00");
  assert.equal(values[EVENT_COLUMNS.indexOf("end_date")], "2027-01-17");
  assert.equal(values[EVENT_COLUMNS.indexOf("price")], 20000);
});

test("an update without end_date (old admin tab) keeps the stored one", () => {
  const { set, values } = eventUpdate(body);
  assert.ok(!set.includes("end_date"));
  assert.equal(set.split(", ").length, EVENT_COLUMNS.length - 1);
  assert.equal(values.length, EVENT_COLUMNS.length - 1);
  assert.equal(set.split(", ")[EVENT_COLUMNS.indexOf("event_date")], "event_date = ?");
  assert.equal(set.split(", ")[EVENT_COLUMNS.indexOf("event_date") + 1], "price = ?");
  assert.equal(values[EVENT_COLUMNS.indexOf("event_date") + 1], 20000);
});

test("an update with end_date sent empty clears it; with a day sets it", () => {
  for (const empty of ["", null, "  "]) {
    const { set, values } = eventUpdate({ ...body, end_date: empty });
    const cols = set.split(", ");
    assert.equal(cols.length, EVENT_COLUMNS.length);
    assert.equal(values[cols.indexOf("end_date = ?")], null);
  }
  const { set, values } = eventUpdate({ ...body, end_date: "2027-01-17" });
  assert.equal(values[set.split(", ").indexOf("end_date = ?")], "2027-01-17");
});
