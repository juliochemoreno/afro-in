"use client";

import * as React from "react";
import { Eye, Ticket, Clock, CheckCircle2, Copy, Check } from "lucide-react";

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
  return (
    <div className="flex h-full items-center">
      <StatusPill status={(p.data as TicketOrderRow).status} />
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

export default function TicketOrdersDashboard() {
  const [orders, setOrders] = React.useState<TicketOrderRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<TicketOrderRow | null>(null);
  const [tickets, setTickets] = React.useState<TicketItem[] | null>(null);

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

      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
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
    </div>
  );
}
