// Door accounts (D26) must be refused by every admin page and API but the
// door. Pages: the middleware sends a door account to the door unless
// isDoorPath(route). APIs: requireAdmin refuses door accounts unless the
// endpoint passes allowDoor. This walks the real route files, so a new admin
// page or API is covered (and changes the counts below, forcing a look).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { isDoorPath } from "../src/lib/doorHost.ts";

const ROOT = new URL("..", import.meta.url).pathname;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

// src/pages/admin/eventos/[id]/index.astro -> /admin/eventos/1
function route(file: string): string {
  const rel = relative(join(ROOT, "src/pages"), file)
    .replace(/\.(astro|ts)$/, "")
    .replace(/\[[^\]]+\]/g, "1")
    .replace(/(^|\/)index$/, "");
  return `/${rel}`;
}

const pages = files(join(ROOT, "src/pages/admin"));
const apis = files(join(ROOT, "src/pages/api/admin"));

test("door accounts reach only the door page and its login", () => {
  assert.equal(pages.length, 15, "admin pages changed: check door access");
  const allowed = pages.map(route).filter(isDoorPath).sort();
  assert.deepEqual(allowed, ["/admin/checkin", "/admin/login"]);
});

test("door accounts reach only the check-in API", () => {
  assert.equal(apis.length, 17, "admin APIs changed: check door access");
  const allowed = apis.map(route).filter(isDoorPath);
  assert.deepEqual(allowed, ["/api/admin/checkin"]);
});

test("every admin API is guarded, and only check-in admits door accounts", () => {
  for (const file of apis) {
    const src = readFileSync(file, "utf8");
    const name = relative(ROOT, file);
    const handlers = src.match(/^export const (GET|POST|PUT|PATCH|DELETE)\b/gm) ?? [];
    const guards = src.match(/requireAdmin\(ctx/g) ?? [];
    assert.ok(handlers.length > 0, `${name} has no handler`);
    assert.equal(guards.length, handlers.length, `${name}: one requireAdmin per handler`);
    const admitsDoor = /allowDoor/.test(src);
    assert.equal(admitsDoor, name === "src/pages/api/admin/checkin.ts", `${name} allowDoor`);
  }
});
