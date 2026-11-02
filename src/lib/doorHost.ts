// The door (D26): the check-in screen and the few routes it needs. The same
// list limits the door host (checkin.afroin.org) and door-role users, so it
// only ever restricts; it never grants access by itself.
// Pure, no "@/" imports, so the tests can load it directly.

export const DOOR_PATH = "/admin/checkin";

const DOOR_PATHS = new Set([
  "/admin/checkin",
  "/admin/login",
  "/api/admin-login",
  "/api/admin-logout",
  "/api/admin/checkin",
]);

/** A route the door needs (the screen, its login/logout and the scan API). */
export function isDoorPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return DOOR_PATHS.has(path);
}

/**
 * The door host: checkin.afroin.org, checkin.localhost for local dev, and a
 * Preview named checkin-<x> (checkin-<x>.afroin.org or its workers.dev URL).
 */
export function isDoorHost(hostname: string): boolean {
  const label = hostname.toLowerCase().split(".")[0];
  return label === "checkin" || label.startsWith("checkin-");
}

/** What the door host does with a path: serve it, send it to the door, or 404. */
export function doorHostRoute(pathname: string): "allow" | "door" | "not_found" {
  if (isDoorPath(pathname)) return "allow";
  if (pathname === "/api" || pathname.startsWith("/api/")) return "not_found";
  return "door";
}
