"use client";

import * as React from "react";
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Ticket,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

import type { ColDef } from "ag-grid-community";
import AdminGrid from "@/components/admin/AdminGrid";
import { isEventOver } from "@/lib/ticketStages";

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

interface EventRow {
  id: number;
  slug: string;
  name_es: string;
  venue?: string | null;
  city?: string | null;
  event_date: string;
  end_date?: string | null;
  price: number;
  capacity: number;
  visible: number;
  sold: number;
  checked_in: number;
  // Price stages (see lib/tickets.ts getEventsForAdmin).
  stages?: unknown[];
  current_stage_name?: string | null;
  current_price?: number | null;
  sale_state?: "current" | "upcoming" | "ended";
}

function PriceCell(p: any) {
  const d = p.data as EventRow;
  if (!d.stages?.length) {
    return (
      <div className="flex h-full items-center justify-end">{COP.format(Number(d.price))}</div>
    );
  }
  return (
    <div className="flex h-full flex-col items-end justify-center leading-tight">
      <span className="text-foreground">
        {d.current_price != null ? COP.format(Number(d.current_price)) : "—"}
      </span>
      <span className="text-muted-foreground truncate text-xs">
        {d.sale_state === "ended"
          ? "Etapas terminadas"
          : d.sale_state === "upcoming"
            ? `Próxima: ${d.current_stage_name}`
            : d.current_stage_name}
      </span>
    </div>
  );
}

function formatDate(ts: string): string {
  const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T"));
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// A whole day (YYYY-MM-DD, e.g. a multi-day event's last day), at noon so the
// browser's time zone never moves it.
function formatDay(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  if (isNaN(d.getTime())) return day;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function NameCell(p: any) {
  const d = p.data as EventRow;
  return (
    <div className="flex h-full flex-col justify-center leading-tight">
      <span className="text-foreground font-semibold">{d.name_es}</span>
      <span className="text-muted-foreground truncate text-xs">
        {[d.venue, d.city].filter(Boolean).join(" · ") || "—"}
      </span>
    </div>
  );
}

function DateCell(p: any) {
  const d = p.data as EventRow;
  const past = isEventOver(d);
  return (
    <div className="flex h-full flex-col justify-center leading-tight">
      <span className={past ? "text-muted-foreground" : "text-foreground"}>
        {formatDate(d.event_date)}
        {d.end_date && ` – ${formatDay(d.end_date)}`}
      </span>
      {past && <span className="text-muted-foreground text-xs">Pasado</span>}
    </div>
  );
}

function CapacityCell(p: any) {
  const d = p.data as EventRow;
  const pct = d.capacity > 0 ? Math.min(100, (d.sold / d.capacity) * 100) : 0;
  const full = d.sold >= d.capacity;
  return (
    <div className="flex h-full flex-col justify-center gap-1">
      <span className="text-foreground text-xs font-medium">
        {d.sold}/{d.capacity}
      </span>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={full ? "bg-destructive h-full" : "bg-primary h-full"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function VisibleCell(p: any) {
  const d = p.data as EventRow;
  const onToggle = p.context?.onToggle as (d: EventRow, v: boolean) => void;
  return (
    <div className="flex h-full items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle?.(d, !d.visible);
        }}
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          d.visible
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {d.visible ? "Visible" : "Oculto"}
      </button>
    </div>
  );
}

function ActionsCell(p: any) {
  const d = p.data as EventRow;
  const onDelete = p.context?.onDelete as (d: EventRow) => void;
  return (
    <div className="flex h-full items-center justify-end gap-1">
      <a
        href={`/eventos/${d.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Ver página pública del evento"
        title="Ver página pública"
        className="hover:bg-muted text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md"
      >
        <ExternalLink className="size-4" />
      </a>
      <a
        href={`/admin/eventos/${d.id}`}
        onClick={(e) => e.stopPropagation()}
        aria-label="Editar"
        title="Editar evento"
        className="hover:bg-muted text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md"
      >
        <Pencil className="size-4" />
      </a>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.(d);
        }}
        aria-label="Eliminar"
        title="Eliminar evento"
        className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-flex size-8 items-center justify-center rounded-md"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card border-border flex items-center gap-3 rounded-xl border p-4 shadow-sm">
      <div className="bg-muted text-foreground flex size-10 items-center justify-center rounded-lg">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="text-foreground text-xl font-bold">{value}</span>
      </div>
    </div>
  );
}

export default function EventsDashboard() {
  const [events, setEvents] = React.useState<EventRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchEvents = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/events");
      if (res.ok) {
        const data = (await res.json()) as { events: EventRow[] };
        setEvents(data.events || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const onToggle = React.useCallback(
    async (d: EventRow, visible: boolean) => {
      setEvents((prev) =>
        prev.map((e) => (e.id === d.id ? { ...e, visible: visible ? 1 : 0 } : e))
      );
      await fetch(`/api/admin/events/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible }),
      }).catch(() => fetchEvents());
    },
    [fetchEvents]
  );

  const onDelete = React.useCallback(
    async (d: EventRow) => {
      if (!confirm(`¿Eliminar "${d.name_es}"? Esta acción no se puede deshacer.`))
        return;
      const res = await fetch(`/api/admin/events/${d.id}`, { method: "DELETE" });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== d.id));
      } else {
        const data = (await res.json().catch(() => ({}))) as any;
        alert(data.error || "No se pudo eliminar el evento.");
      }
    },
    []
  );

  const stats = React.useMemo(() => {
    const totalSold = events.reduce((s, e) => s + Number(e.sold || 0), 0);
    const totalCheckedIn = events.reduce(
      (s, e) => s + Number(e.checked_in || 0),
      0
    );
    return { total: events.length, sold: totalSold, checkedIn: totalCheckedIn };
  }, [events]);

  const columnDefs = React.useMemo<ColDef<EventRow>[]>(
    () => [
      {
        headerName: "Evento",
        field: "name_es",
        flex: 2,
        minWidth: 200,
        cellRenderer: NameCell,
      },
      {
        headerName: "Fecha",
        field: "event_date",
        flex: 1,
        minWidth: 160,
        cellRenderer: DateCell,
      },
      {
        headerName: "Precio",
        field: "price",
        width: 130,
        type: "rightAligned",
        cellRenderer: PriceCell,
      },
      {
        headerName: "Vendidas",
        field: "sold",
        width: 140,
        cellRenderer: CapacityCell,
      },
      {
        headerName: "Check-in",
        field: "checked_in",
        width: 110,
        type: "rightAligned",
      },
      {
        headerName: "Estado",
        field: "visible",
        width: 120,
        cellRenderer: VisibleCell,
      },
      {
        headerName: "",
        colId: "actions",
        width: 130,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: ActionsCell,
      },
    ],
    []
  );

  return (
    <div className="text-foreground flex flex-col gap-4 p-6 lg:h-full lg:min-h-0">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Eventos</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gestiona los eventos y su venta de entradas
          </p>
        </div>
        <a
          href="/admin/eventos/nuevo"
          className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90"
        >
          <Plus className="size-4" />
          Nuevo evento
        </a>
      </header>

      <div className="grid shrink-0 grid-cols-3 gap-3">
        <Stat
          icon={<CalendarDays className="size-5" />}
          label="Eventos"
          value={String(stats.total)}
        />
        <Stat
          icon={<Ticket className="size-5" />}
          label="Entradas vendidas"
          value={String(stats.sold)}
        />
        <Stat
          icon={<CheckCircle2 className="size-5" />}
          label="Check-in"
          value={String(stats.checkedIn)}
        />
      </div>

      <AdminGrid<EventRow>
        rowData={events}
        columnDefs={columnDefs}
        context={{ onToggle, onDelete }}
        loading={loading}
        rowHeight={60}
        onRowClicked={(e: any) => {
          if (e.data) window.location.href = `/admin/eventos/${e.data.id}`;
        }}
        overlayNoRowsTemplate="Aún no hay eventos."
      />
    </div>
  );
}
