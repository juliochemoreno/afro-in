import { test } from "node:test";
import assert from "node:assert/strict";
import { doorHostRoute, isDoorHost, isDoorPath } from "../src/lib/doorHost.ts";

test("isDoorHost matches the checkin label only", () => {
  for (const host of [
    "checkin.afroin.org",
    "CHECKIN.afroin.org",
    "checkin.localhost",
    "checkin-d26.afroin.org",
    "checkin-d26-afro-in.afroinsantamarta.workers.dev",
  ]) {
    assert.equal(isDoorHost(host), true, host);
  }
  for (const host of [
    "afroin.org",
    "www.afroin.org",
    "dev.afroin.org",
    "localhost",
    "mycheckin.afroin.org",
    "checkins.afroin.org",
    "dev.checkin.afroin.org",
  ]) {
    assert.equal(isDoorHost(host), false, host);
  }
});

test("isDoorPath allows the door routes, with or without a trailing slash", () => {
  for (const path of [
    "/admin/checkin",
    "/admin/login",
    "/api/admin-login",
    "/api/admin-logout",
    "/api/admin/checkin",
  ]) {
    assert.equal(isDoorPath(path), true, path);
    assert.equal(isDoorPath(`${path}/`), true, `${path}/`);
  }
  for (const path of ["/", "/admin", "/admin/", "/admin/pedidos", "/admin/checkin/x", "/api/admin/orders"]) {
    assert.equal(isDoorPath(path), false, path);
  }
});

test("doorHostRoute sends everything else to the door, other APIs to 404", () => {
  assert.equal(doorHostRoute("/admin/checkin"), "allow");
  assert.equal(doorHostRoute("/api/admin/checkin"), "allow");
  assert.equal(doorHostRoute("/api/admin/orders"), "not_found");
  assert.equal(doorHostRoute("/api/contador"), "not_found");
  assert.equal(doorHostRoute("/admin/pedidos"), "door");
  assert.equal(doorHostRoute("/"), "door");
  assert.equal(doorHostRoute("/tienda"), "door");
  assert.equal(doorHostRoute("/apix"), "door");
});
