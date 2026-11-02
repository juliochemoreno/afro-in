// What the door screen shows for a scan (D26). Mirrors CheckInResult
// (lib/tickets.ts); the client adds "error" (network) and "expired" (401: the
// door session ended). day/days/today come from a multi-day pass (D25).
// Pure, no "@/" imports, so the tests can load it directly.

export type Verdict =
  | { result: "ok"; attendee: string; eventName: string; day?: number; days?: number }
  | {
      result: "already";
      attendee: string;
      eventName: string;
      checkedInAt: string;
      today?: boolean;
    }
  | {
      result: "out_of_range";
      attendee: string;
      eventName: string;
      startDate: string;
      endDate: string;
    }
  | { result: "not_found" }
  | { result: "not_paid" }
  | { result: "error" }
  | { result: "expired" };

export type DoorTone = "ok" | "warn" | "bad";

export interface DoorView {
  tone: DoorTone;
  title: string;
  detail?: string;
}

/** Green for a valid entry, amber for one already used, red for the rest. */
export function doorVerdict(v: Verdict): DoorView {
  switch (v.result) {
    case "ok":
      return {
        tone: "ok",
        title: v.attendee,
        detail: v.days ? `Válida · día ${v.day} de ${v.days}` : v.eventName,
      };
    case "already":
      return {
        tone: "warn",
        title: v.today ? "Ya entró hoy" : "Ya usada",
        detail: `${v.attendee} · ${v.today ? "a las " : ""}${formatTime(v.checkedInAt)}`,
      };
    case "out_of_range":
      return {
        tone: "bad",
        title: "Fuera de fechas",
        detail: `${v.attendee} · ${formatDay(v.startDate)} a ${formatDay(v.endDate)}`,
      };
    case "not_paid":
      return { tone: "bad", title: "Pago no confirmado" };
    case "error":
      return { tone: "bad", title: "Error de red", detail: "Reintenta" };
    case "expired":
      return { tone: "bad", title: "Sesión vencida", detail: "Vuelve a ingresar" };
    default:
      return { tone: "bad", title: "No encontrada" };
  }
}

export function formatTime(ts: string): string {
  if (!ts) return "";
  const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Bogota",
  });
}

// "2027-01-15" -> "15 ene" (a calendar date, so read and shown in UTC).
export function formatDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
}
