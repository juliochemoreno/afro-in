"use client";

import * as React from "react";
import { Eye, Ticket, Clock, CheckCircle2, Copy, Check, Gift, Download } from "lucide-react";

import type { ColDef } from "ag-grid-community";
import AdminGrid from "@/components/admin/AdminGrid";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

interface TicketOrderRow {
  id: number;
  bold_order_id: string;
  status: string;
  provider?: string;
  amount: number;
  event_id: number;
  event_name: string;
  quantity: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string | null;
  access_token: string;
  ticket_count: number;
  checked_in_count: number;
  created_at: string;
  paid_at?: string | null;
}

interface TicketItem {
  id: number;
  code: string;
  status: string;
  checked_in_at?: string | null;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  completed: {
    label: "Pagado",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  pending: {
    label: "Pendiente",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  },
  rejected: {
    label: "Rechazado",
    cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  },
};

function formatDate(ts?: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return ts;
  const date = d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d
    .toLocaleTimeString("es-CO", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();
  return `${date} · ${time}`;
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] || { label: status, cls: "bg-muted text-foreground" };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

function OrderCell(p: any) {
  const d = p.data as TicketOrderRow;
  return (
    <div className="flex h-full flex-col justify-center leading-tight">
      <span className="text-foreground font-semibold">#{d.id}</span>
      <span className="text-muted-foreground text-xs">
        {formatDate(d.created_at)}
      </span>
    </div>
  );
}

function BuyerCell(p: any) {
  const d = p.data as TicketOrderRow;
  return (
    <div className="flex h-full flex-col justify-center leading-tight">
      <span className="text-foreground truncate font-medium">
        {d.buyer_name}
      </span>
      <span className="text-muted-foreground truncate text-xs">
        {d.buyer_email}
      </span>
    </div>
  );
}

function CheckedInCell(p: any) {
  const d = p.data as TicketOrderRow;
  return (
    <div className="flex h-full items-center justify-end">
      <span className="text-foreground text-sm">
        {d.checked_in_count}/{d.ticket_count || d.quantity}
      </span>
    </div>
  );
}

function StatusCell(p: any) {
  const d = p.data as TicketOrderRow;
  if (d.provider === "courtesy") {
    return (
      <div className="flex h-full items-center">
        <span className="bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold">
          Cortesía
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-full items-center">
      <StatusPill status={d.status} />
    </div>
  );
}

function ViewCell(p: any) {
  const d = p.data as TicketOrderRow;
  const onView = p.context?.onView as (d: TicketOrderRow) => void;
  return (
    <div className="flex h-full items-center justify-end">
      <button
        type="button"
        onClick={() => onView?.(d)}
        aria-label="Ver detalles"
        className="hover:bg-muted text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md"
      >
        <Eye className="size-4" />
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

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* ignore */
        }
      }}
      className="border-border text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copiado" : "Copiar enlace"}
    </button>
  );
}

interface EventOption {
  id: number;
  name_es: string;
  capacity: number;
  sold: number;
}

export default function TicketOrdersDashboard() {
  const [orders, setOrders] = React.useState<TicketOrderRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<TicketOrderRow | null>(null);
  const [tickets, setTickets] = React.useState<TicketItem[] | null>(null);

  const [courtesyOpen, setCourtesyOpen] = React.useState(false);
  const [eventsList, setEventsList] = React.useState<EventOption[]>([]);
  const [courtesyLoading, setCourtesyLoading] = React.useState(false);
  const [courtesyError, setCourtesyError] = React.useState<string | null>(null);
  const [courtesySuccess, setCourtesySuccess] = React.useState<{
    eventName: string;
    quantity: number;
    accessToken: string;
    ticketCodes: string[];
  } | null>(null);

  const [courtesyForm, setCourtesyForm] = React.useState({
    eventId: "",
    name: "",
    email: "",
    phone: "",
    quantity: 1,
  });

  const openCourtesyModal = async () => {
    setCourtesyOpen(true);
    setCourtesyError(null);
    setCourtesySuccess(null);
    try {
      const res = await fetch("/api/admin/events");
      if (res.ok) {
        const data = (await res.json()) as { events: EventOption[] };
        setEventsList(data.events || []);
        if (data.events?.length > 0) {
          setCourtesyForm((f) => ({
            ...f,
            eventId: f.eventId || String(data.events[0].id),
          }));
        }
      }
    } catch (e) {
      console.error("Error loading events", e);
    }
  };

  const submitCourtesy = async (e: React.FormEvent) => {
    e.preventDefault();
    setCourtesyError(null);

    if (!courtesyForm.eventId) {
      setCourtesyError("Selecciona un evento.");
      return;
    }
    if (!courtesyForm.name.trim()) {
      setCourtesyError("El nombre del beneficiario es obligatorio.");
      return;
    }
    if (!courtesyForm.email.trim() || !courtesyForm.email.includes("@")) {
      setCourtesyError("Ingresa un correo electrónico válido.");
      return;
    }

    setCourtesyLoading(true);
    try {
      const res = await fetch("/api/admin/tickets/courtesy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: Number(courtesyForm.eventId),
          quantity: Number(courtesyForm.quantity),
          buyer: {
            name: courtesyForm.name.trim(),
            email: courtesyForm.email.trim(),
            phone: courtesyForm.phone.trim() || null,
          },
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        setCourtesyError(data?.error || "No se pudo emitir la cortesía.");
        return;
      }

      setCourtesySuccess({
        eventName: data.eventName,
        quantity: data.quantity,
        accessToken: data.accessToken,
        ticketCodes: data.ticketCodes || [],
      });
      setCourtesyForm({
        eventId: courtesyForm.eventId,
        name: "",
        email: "",
        phone: "",
        quantity: 1,
      });
      fetchOrders();
    } catch (err: any) {
      setCourtesyError("Error de conexión al emitir cortesía.");
    } finally {
      setCourtesyLoading(false);
    }
  };

  const fetchOrders = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tickets");
      if (res.ok) {
        const data = (await res.json()) as { orders: TicketOrderRow[] };
        setOrders(data.orders || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onView = React.useCallback(async (o: TicketOrderRow) => {
    setSelected(o);
    setTickets(null);
    try {
      const res = await fetch(`/api/admin/tickets/${o.id}`);
      if (res.ok) {
        const data = (await res.json()) as { order: { tickets: TicketItem[] } };
        setTickets(data.order.tickets || []);
      } else setTickets([]);
    } catch {
      setTickets([]);
    }
  }, []);

  const stats = React.useMemo(() => {
    const paid = orders.filter((o) => o.status === "completed");
    const pending = orders.filter((o) => o.status === "pending");
    const revenue = paid.reduce((s, o) => s + Number(o.amount || 0), 0);
    return {
      total: orders.length,
      paid: paid.length,
      pending: pending.length,
      revenue,
    };
  }, [orders]);

  const columnDefs = React.useMemo<ColDef<TicketOrderRow>[]>(
    () => [
      { headerName: "Compra", field: "id", width: 180, cellRenderer: OrderCell },
      {
        headerName: "Evento",
        field: "event_name",
        flex: 1.5,
        minWidth: 160,
      },
      {
        headerName: "Comprador",
        field: "buyer_name",
        flex: 1.5,
        minWidth: 200,
        cellRenderer: BuyerCell,
      },
      {
        headerName: "Cant.",
        field: "quantity",
        width: 90,
        type: "rightAligned",
      },
      {
        headerName: "Total",
        field: "amount",
        width: 140,
        type: "rightAligned",
        valueFormatter: (p) =>
          p.value != null ? COP.format(Number(p.value)) : "",
      },
      {
        headerName: "Check-in",
        field: "checked_in_count",
        width: 110,
        cellRenderer: CheckedInCell,
      },
      {
        headerName: "Estado",
        field: "status",
        width: 130,
        cellRenderer: StatusCell,
      },
      {
        headerName: "",
        colId: "actions",
        width: 70,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: ViewCell,
      },
    ],
    []
  );

  const permalink =
    selected && typeof window !== "undefined"
      ? `${window.location.origin}/entradas/${selected.access_token}`
      : "";

  return (
    <div className="text-foreground flex flex-col gap-4 p-6 lg:h-full lg:min-h-0">
      <header className="shrink-0">
        <h1 className="text-3xl font-extrabold tracking-tight">Entradas</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Compras de entradas pagadas con Bold
        </p>
      </header>

      <div className="flex items-center justify-between shrink-0 mb-2">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 flex-1">
          <Stat
            icon={<Ticket className="size-5" />}
            label="Compras"
            value={String(stats.total)}
          />
          <Stat
            icon={<CheckCircle2 className="size-5" />}
            label="Pagadas"
            value={String(stats.paid)}
          />
          <Stat
            icon={<Clock className="size-5" />}
            label="Pendientes"
            value={String(stats.pending)}
          />
          <Stat
            icon={<Ticket className="size-5" />}
            label="Ingresos"
            value={COP.format(stats.revenue)}
          />
        </div>
        
        <div className="ml-4 flex items-center gap-2">
          <button
            type="button"
            onClick={openCourtesyModal}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-colors"
          >
            <Gift className="size-4" />
            Emitir cortesía
          </button>
          <button
            type="button"
            onClick={() => {
              if (!orders || orders.length === 0) return;
              const headers = ["ID", "Evento", "Comprador", "Email", "Teléfono", "Cantidad", "Total", "Check-in", "Estado", "Fecha"];
              // Buyer fields come from the public checkout: quote them and
              // neutralise spreadsheet formulas (=, +, -, @, tab, CR).
              const cell = (v: string | null | undefined) => {
                const text = String(v ?? "");
                const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
                return `"${safe.replace(/"/g, '""')}"`;
              };
              const rows = orders.map(o => [
                o.id,
                cell(o.event_name),
                cell(o.buyer_name),
                cell(o.buyer_email),
                cell(o.buyer_phone),
                o.quantity,
                o.amount,
                `${o.checked_in_count}/${o.ticket_count || o.quantity}`,
                o.status,
                `"${formatDate(o.created_at)}"`
              ]);
              const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.setAttribute("href", url);
              link.setAttribute("download", `asistentes_eventos_${new Date().toISOString().split('T')[0]}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="border-border text-foreground hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition-colors"
          >
            <Download className="size-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      <AdminGrid<TicketOrderRow>
        rowData={orders}
        columnDefs={columnDefs}
        context={{ onView }}
        loading={loading}
        rowHeight={56}
        onRowClicked={(e: any) => e.data && onView(e.data)}
        overlayNoRowsTemplate="Aún no hay compras de entradas."
      />

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Compra #{selected.id}
                  <StatusPill status={selected.status} />
                </DialogTitle>
                <DialogDescription>
                  {selected.event_name} ·{" "}
                  {COP.format(Number(selected.amount))}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <section>
                  <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
                    Comprador
                  </h4>
                  <p className="text-foreground font-medium">
                    {selected.buyer_name}
                  </p>
                  <p className="text-muted-foreground">{selected.buyer_email}</p>
                  {selected.buyer_phone && (
                    <p className="text-muted-foreground">
                      {selected.buyer_phone}
                    </p>
                  )}
                </section>

                {selected.status === "completed" && (
                  <section>
                    <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
                      Enlace permanente
                    </h4>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={permalink}
                        onFocus={(e) => e.target.select()}
                        className="border-border bg-muted/40 min-w-0 flex-1 rounded-md border px-2 py-1 text-xs"
                      />
                      <CopyLink url={permalink} />
                    </div>
                  </section>
                )}

                <section>
                  <h4 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                    Entradas
                  </h4>
                  {tickets === null ? (
                    <p className="text-muted-foreground">Cargando…</p>
                  ) : tickets.length === 0 ? (
                    <p className="text-muted-foreground">
                      Sin entradas emitidas (pago no completado).
                    </p>
                  ) : (
                    <ul className="divide-border divide-y">
                      {tickets.map((tk) => (
                        <li
                          key={tk.id}
                          className="flex items-center justify-between gap-3 py-2"
                        >
                          <span className="text-foreground font-mono tracking-wider">
                            {tk.code}
                          </span>
                          {tk.status === "checked_in" ? (
                            <span className="text-emerald-600 dark:text-emerald-400 text-xs">
                              Usada · {formatDate(tk.checked_in_at)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              Válida
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={courtesyOpen}
        onOpenChange={(o) => {
          if (!o) {
            setCourtesyOpen(false);
            setCourtesySuccess(null);
            setCourtesyError(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="text-primary size-5" />
              Emitir Entrada de Cortesía
            </DialogTitle>
            <DialogDescription>
              Genera entradas gratuitas directamente para invitados, miembros del equipo o prensa.
            </DialogDescription>
          </DialogHeader>

          {courtesySuccess ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                <div className="mb-1 flex items-center gap-2 text-base font-semibold">
                  <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                  ¡Cortesía emitida con éxito!
                </div>
                <p className="text-sm">
                  Se generaron {courtesySuccess.quantity} entrada(s) para <strong>{courtesySuccess.eventName}</strong>.
                </p>
              </div>

              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-semibold uppercase">
                  Enlace de las entradas (Compártelo con el invitado)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/entradas/${courtesySuccess.accessToken}`}
                    onFocus={(e) => e.target.select()}
                    className="border-border bg-muted/40 min-w-0 flex-1 rounded-md border px-3 py-2 font-mono text-xs"
                  />
                  <CopyLink
                    url={`${typeof window !== "undefined" ? window.location.origin : ""}/entradas/${courtesySuccess.accessToken}`}
                  />
                </div>
              </div>

              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-semibold uppercase">
                  Códigos de entradas generados
                </label>
                <div className="flex flex-wrap gap-2">
                  {courtesySuccess.ticketCodes.map((code) => (
                    <span
                      key={code}
                      className="bg-muted text-foreground rounded px-2.5 py-1 font-mono text-xs font-bold tracking-wider"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setCourtesySuccess(null);
                    setCourtesyOpen(false);
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submitCourtesy} className="space-y-4 py-2">
              {courtesyError && (
                <div className="bg-destructive/10 border-destructive/20 text-destructive rounded-lg border p-3 text-sm font-medium">
                  {courtesyError}
                </div>
              )}

              <div>
                <label className="text-foreground mb-1 block text-xs font-semibold uppercase">
                  Evento <span className="text-destructive">*</span>
                </label>
                <select
                  value={courtesyForm.eventId}
                  onChange={(e) =>
                    setCourtesyForm((f) => ({ ...f, eventId: e.target.value }))
                  }
                  required
                  className="border-border bg-background text-foreground focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                >
                  {eventsList.length === 0 && (
                    <option value="">Cargando eventos...</option>
                  )}
                  {eventsList.map((ev) => {
                    const remaining = Math.max(0, ev.capacity - ev.sold);
                    return (
                      <option key={ev.id} value={ev.id}>
                        {ev.name_es} ({remaining} cupos disp.)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-foreground mb-1 block text-xs font-semibold uppercase">
                    Nombre del beneficiario <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carlos Valderrama"
                    value={courtesyForm.name}
                    onChange={(e) =>
                      setCourtesyForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="border-border bg-background text-foreground focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  />
                </div>

                <div>
                  <label className="text-foreground mb-1 block text-xs font-semibold uppercase">
                    Cantidad de entradas <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={courtesyForm.quantity}
                    onChange={(e) =>
                      setCourtesyForm((f) => ({
                        ...f,
                        quantity: Math.max(1, parseInt(e.target.value) || 1),
                      }))
                    }
                    className="border-border bg-background text-foreground focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-foreground mb-1 block text-xs font-semibold uppercase">
                    Correo electrónico <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="invitado@correo.com"
                    value={courtesyForm.email}
                    onChange={(e) =>
                      setCourtesyForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className="border-border bg-background text-foreground focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  />
                </div>

                <div>
                  <label className="text-foreground mb-1 block text-xs font-semibold uppercase">
                    Teléfono (opcional)
                  </label>
                  <input
                    type="tel"
                    placeholder="300 123 4567"
                    value={courtesyForm.phone}
                    onChange={(e) =>
                      setCourtesyForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className="border-border bg-background text-foreground focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCourtesyOpen(false)}
                  disabled={courtesyLoading}
                  className="border-border text-foreground hover:bg-muted rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={courtesyLoading}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {courtesyLoading ? "Emitiendo..." : "Generar Entradas"}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
