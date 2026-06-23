"use client";

import * as React from "react";
import { Eye, Package, ShoppingBag, Clock, CheckCircle2 } from "lucide-react";

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

interface OrderRow {
  id: number;
  bold_order_id: string;
  status: string;
  amount: number;
  subtotal: number;
  item_count: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  ship_country?: string | null;
  ship_department?: string | null;
  ship_city?: string | null;
  ship_address?: string | null;
  ship_notes?: string | null;
  created_at: string;
  paid_at?: string | null;
}

interface OrderItem {
  name: string;
  size?: string | null;
  color?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
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

// --- cell renderers ---
function OrderCell(p: any) {
  const d = p.data as OrderRow;
  return (
    <div className="flex h-full flex-col justify-center leading-tight">
      <span className="text-foreground font-semibold">#{d.id}</span>
      <span className="text-muted-foreground text-xs">
        {formatDate(d.created_at)}
      </span>
    </div>
  );
}

function CustomerCell(p: any) {
  const d = p.data as OrderRow;
  return (
    <div className="flex h-full flex-col justify-center leading-tight">
      <span className="text-foreground truncate font-medium">
        {d.customer_name}
      </span>
      <span className="text-muted-foreground truncate text-xs">
        {d.customer_email}
      </span>
    </div>
  );
}

function StatusCell(p: any) {
  return (
    <div className="flex h-full items-center">
      <StatusPill status={(p.data as OrderRow).status} />
    </div>
  );
}

function ViewCell(p: any) {
  const d = p.data as OrderRow;
  const onView = p.context?.onView as (d: OrderRow) => void;
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

export default function OrdersDashboard() {
  const [orders, setOrders] = React.useState<OrderRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<OrderRow | null>(null);
  const [items, setItems] = React.useState<OrderItem[] | null>(null);

  const fetchOrders = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders");
      if (res.ok) {
        const data = (await res.json()) as { orders: OrderRow[] };
        setOrders(data.orders || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onView = React.useCallback(async (o: OrderRow) => {
    setSelected(o);
    setItems(null);
    try {
      const res = await fetch(`/api/admin/orders/${o.id}`);
      if (res.ok) {
        const data = (await res.json()) as { order: { items: OrderItem[] } };
        setItems(data.order.items || []);
      } else setItems([]);
    } catch {
      setItems([]);
    }
  }, []);

  const stats = React.useMemo(() => {
    const paid = orders.filter((o) => o.status === "completed");
    const pending = orders.filter((o) => o.status === "pending");
    const revenue = paid.reduce((s, o) => s + Number(o.amount || 0), 0);
    return { total: orders.length, paid: paid.length, pending: pending.length, revenue };
  }, [orders]);

  const columnDefs = React.useMemo<ColDef<OrderRow>[]>(
    () => [
      { headerName: "Pedido", field: "id", width: 190, cellRenderer: OrderCell },
      {
        headerName: "Cliente",
        field: "customer_name",
        flex: 2,
        minWidth: 220,
        cellRenderer: CustomerCell,
      },
      {
        headerName: "Productos",
        field: "item_count",
        width: 120,
        type: "rightAligned",
      },
      {
        headerName: "Total",
        field: "amount",
        width: 150,
        type: "rightAligned",
        valueFormatter: (p) => (p.value != null ? COP.format(Number(p.value)) : ""),
      },
      {
        headerName: "Estado",
        field: "status",
        width: 140,
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

  return (
    <div className="text-foreground flex flex-col gap-4 p-6 lg:h-full lg:min-h-0">
      <header className="shrink-0">
        <h1 className="text-3xl font-extrabold tracking-tight">Pedidos</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Compras de la tienda pagadas con Bold
        </p>
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={<ShoppingBag className="size-5" />}
          label="Pedidos"
          value={String(stats.total)}
        />
        <Stat
          icon={<CheckCircle2 className="size-5" />}
          label="Pagados"
          value={String(stats.paid)}
        />
        <Stat
          icon={<Clock className="size-5" />}
          label="Pendientes"
          value={String(stats.pending)}
        />
        <Stat
          icon={<Package className="size-5" />}
          label="Ingresos"
          value={COP.format(stats.revenue)}
        />
      </div>

      <AdminGrid<OrderRow>
        rowData={orders}
        columnDefs={columnDefs}
        context={{ onView }}
        loading={loading}
        rowHeight={56}
        onRowClicked={(e: any) => e.data && onView(e.data)}
        overlayNoRowsTemplate="Aún no hay pedidos."
      />

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Pedido #{selected.id}
                  <StatusPill status={selected.status} />
                </DialogTitle>
                <DialogDescription>
                  {formatDate(selected.created_at)} · {COP.format(Number(selected.amount))}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <section>
                  <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
                    Cliente
                  </h4>
                  <p className="text-foreground font-medium">{selected.customer_name}</p>
                  <p className="text-muted-foreground">{selected.customer_email}</p>
                  {selected.customer_phone && (
                    <p className="text-muted-foreground">{selected.customer_phone}</p>
                  )}
                </section>

                <section>
                  <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
                    Envío
                  </h4>
                  <p className="text-foreground">
                    {[selected.ship_address, selected.ship_city, selected.ship_department, selected.ship_country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                  {selected.ship_notes && (
                    <p className="text-muted-foreground mt-1 italic">
                      {selected.ship_notes}
                    </p>
                  )}
                </section>

                <section>
                  <h4 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                    Productos
                  </h4>
                  {items === null ? (
                    <p className="text-muted-foreground">Cargando…</p>
                  ) : (
                    <ul className="divide-border divide-y">
                      {items.map((it, i) => (
                        <li key={i} className="flex justify-between gap-3 py-2">
                          <span className="text-foreground">
                            {it.name}
                            {[it.size, it.color].filter(Boolean).length
                              ? ` (${[it.size, it.color].filter(Boolean).join(" · ")})`
                              : ""}{" "}
                            <span className="text-muted-foreground">×{it.quantity}</span>
                          </span>
                          <span className="text-foreground font-medium">
                            {COP.format(Number(it.line_total))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <div className="border-border flex justify-between border-t pt-3 text-base font-bold">
                  <span>Total</span>
                  <span>{COP.format(Number(selected.amount))}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
