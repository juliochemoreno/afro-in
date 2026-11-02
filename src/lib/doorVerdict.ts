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
  /** The verdict, short. */
  title: string;
  /** Who and which event, when known. */
  lines: string[];
  /** What happened and what the door staff should do. */
  hint: string;
}

/** Green for a valid entry, amber for one already used, red for the rest. */
export function doorVerdict(v: Verdict): DoorView {
  switch (v.result) {
    case "ok":
      return {
        tone: "ok",
        title: "Puede entrar",
        lines: [v.attendee, v.days ? `${v.eventName} · día ${v.day} de ${v.days}` : v.eventName],
        hint: v.days ? "Entrada de hoy registrada." : "Entrada registrada.",
      };
    case "already":
      return v.today
        ? {
            tone: "warn",
            title: "Ya entró hoy",
            lines: [v.attendee, `Entró a las ${formatTime(v.checkedInAt)}`],
            hint: "Este pase ya se usó hoy. No dejar pasar de nuevo.",
          }
        : {
            tone: "warn",
            title: "Entrada ya usada",
            lines: [v.attendee, `Se usó el ${formatDateTime(v.checkedInAt)}`],
            hint: "Esta entrada ya se usó. No dejar pasar de nuevo.",
          };
    case "out_of_range":
      return {
        tone: "bad",
        title: "Fuera de fechas",
        lines: [v.attendee, `Válido del ${formatDay(v.startDate)} al ${formatDay(v.endDate)}`],
        hint: "Hoy no es un día de este pase.",
      };
    case "not_paid":
      return {
        tone: "bad",
        title: "Pago no confirmado",
        lines: [],
        hint: "La compra no aparece pagada. Pide el comprobante y consulta a un administrador.",
      };
    case "error":
      return {
        tone: "bad",
        title: "Sin conexión",
        lines: [],
        hint: "No se pudo validar. Revisa el internet y vuelve a escanear.",
      };
    case "expired":
      return {
        tone: "bad",
        title: "Sesión vencida",
        lines: [],
        hint: "Vuelve a ingresar para seguir validando entradas.",
      };
    default:
      return {
        tone: "bad",
        title: "Entrada no encontrada",
        lines: [],
        hint: "Este código no es una entrada de AFRO IN. Revísalo o escríbelo a mano.",
      };
  }
}

function toDate(ts: string): Date {
  return new Date(ts.includes("T") ? ts : ts.replace(" ", "T") + "Z");
}

export function formatTime(ts: string): string {
  if (!ts) return "";
  const d = toDate(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Bogota",
  });
}

// "2027-01-16 02:30:00" (UTC) -> "15 ene a las 9:30 p. m." (Bogotá).
export function formatDateTime(ts: string): string {
  if (!ts) return "";
  const d = toDate(ts);
  if (isNaN(d.getTime())) return ts;
  const day = d.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    timeZone: "America/Bogota",
  });
  return `${day} a las ${formatTime(ts)}`;
}

// "2027-01-15" -> "15 ene" (a calendar date, so read and shown in UTC).
export function formatDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
}
