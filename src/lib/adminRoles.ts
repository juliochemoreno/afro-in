// Admin roles (D26). "door" accounts may use only the door (lib/doorHost.ts
// isDoorPath) and only until their active_until door day. Shared by the server
// and the Administradores island, so it stays pure and browser-safe.

import { doorDay } from "./doorDay.ts";

export type AdminRole = "superadmin" | "admin" | "door";

export const DOOR_ROLE = "door";

/** Unknown or missing roles stay "admin", as before D26 (never superadmin). */
export function parseRole(raw: unknown): AdminRole {
  if (raw === "superadmin" || raw === "door") return raw;
  return "admin";
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(ymd: string): boolean {
  if (!YMD.test(ymd)) return false;
  const d = new Date(`${ymd}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
}

/**
 * Whether the account may still be used at `now`. Door accounts need a valid
 * active_until and stop when the door day after it starts (06:00 Bogotá).
 */
export function accountActive(
  account: { role: string; active_until?: string | null },
  now: number = Date.now()
): boolean {
  if (account.role !== DOOR_ROLE) return true;
  const until = account.active_until ?? "";
  return isCalendarDate(until) && doorDay(now) <= until;
}

/** A door account's "Activo hasta": a real date, not before today's door day. */
export function validActiveUntil(raw: unknown, now: number = Date.now()): string | null {
  if (typeof raw !== "string") return null;
  const ymd = raw.trim();
  return isCalendarDate(ymd) && ymd >= doorDay(now) ? ymd : null;
}
