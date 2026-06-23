"use client";

import * as React from "react";
import {
  Search,
  Download,
  ChevronRight,
  Eye,
  EyeOff,
  DollarSign,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentIcon } from "@/components/PaymentIcon";

export interface Donor {
  id?: number;
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  countryName?: string;
  countryEmoji?: string;
  amount?: number;
  currency?: string;
  status?: string;
  provider?: string;
  created_at?: string;
  completed_at?: string;
  transaction_id?: string;
  bold_order_id?: string;
  provider_status?: string;
  message?: string;
}

interface Props {
  donors: Donor[];
  generatedAt: string;
}

const GOAL = 1_000_000; // Un Millón de Corazones

// PayPal always charges in USD, Bold always in COP. Trust the stored currency
// but fall back to the provider when it is missing.
function currencyOf(d: Donor) {
  return (d.currency || (d.provider === "bold" ? "COP" : "USD")).toUpperCase();
}

function formatCurrency(amount = 0, currency = "COP") {
  const cur = (currency || "COP").toUpperCase();
  const isUsd = cur === "USD";
  const formatted = new Intl.NumberFormat(isUsd ? "en-US" : "es-CO", {
    style: "currency",
    currency: isUsd ? "USD" : "COP",
    minimumFractionDigits: isUsd ? 2 : 0,
  }).format(amount);
  return `${formatted} ${cur}`;
}

// D1 stores timestamps in UTC as "YYYY-MM-DD HH:MM:SS" (no timezone). Treat
// that shape as UTC; ISO strings (with Z/offset) are parsed as-is.
function parseDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(value.replace(" ", "T") + "Z");
  }
  return new Date(value);
}

// Rendered in the viewer's local timezone (no fixed timeZone option).
function formatDate(value?: string) {
  if (!value) return "—";
  const d = parseDate(value);
  const day = d.toLocaleDateString("es-CO", { day: "2-digit" });
  const month = d
    .toLocaleDateString("es-CO", { month: "short" })
    .replace(".", "");
  const year = d.toLocaleDateString("es-CO", { year: "numeric" });
  const time = d.toLocaleTimeString("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${day} ${month}, ${year} · ${time}`;
}

const STATUS = {
  completed: {
    label: "Completado",
    title: "Cobro exitoso",
    variant: "success",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pendiente",
    title: "Pago pendiente",
    variant: "warning",
    icon: Clock,
  },
  pending_payment: {
    label: "Pendiente",
    title: "Pago pendiente",
    variant: "warning",
    icon: Clock,
  },
  rejected: {
    label: "Rechazado",
    title: "Pago rechazado",
    variant: "destructive",
    icon: XCircle,
  },
} as const;

function statusInfo(status?: string) {
  return (
    STATUS[(status || "") as keyof typeof STATUS] || {
      label: status || "—",
      title: status || "—",
      variant: "secondary" as const,
      icon: undefined,
    }
  );
}

function StatusBadge({ status }: { status?: string }) {
  const info = statusInfo(status);
  const Icon = info.icon;
  return (
    <Badge variant={info.variant}>
      {Icon ? <Icon /> : null}
      {info.label}
    </Badge>
  );
}

function StatCard({
  icon,
  label,
  children,
  action,
  hint,
  hero = false,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  hint?: React.ReactNode;
  hero?: boolean;
}) {
  return (
    <Card
      className={cn(
        "relative gap-0 p-4",
        hero && "border-0 bg-neutral-900 text-white shadow-lg"
      )}
    >
      {action ? <div className="absolute top-3 right-3">{action}</div> : null}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            hero ? "bg-[#e31c25] text-white" : "bg-[#e31c25]/10 text-[#e31c25]"
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-semibold",
              hero ? "text-white/70" : "text-muted-foreground"
            )}
          >
            {label}
          </p>
          <div className="mt-0.5 leading-tight">{children}</div>
        </div>
      </div>
      {hint ? (
        <div
          className={cn(
            "mt-3 border-t pt-2.5 text-xs font-medium",
            hero
              ? "border-white/10 text-white/60"
              : "border-border text-muted-foreground"
          )}
        >
          {hint}
        </div>
      ) : null}
    </Card>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-foreground max-w-[60%] text-right text-sm font-medium break-words">
        {value}
      </span>
    </div>
  );
}

export default function DonorsDashboard({ donors, generatedAt }: Props) {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [method, setMethod] = React.useState("all");
  const [hideTotals, setHideTotals] = React.useState(false);
  const [selected, setSelected] = React.useState<Donor | null>(null);

  const stats = React.useMemo(() => {
    const completed = donors.filter((d) => d.status === "completed");
    const cop = completed
      .filter((d) => currencyOf(d) === "COP")
      .reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const usd = completed
      .filter((d) => currencyOf(d) === "USD")
      .reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const people = new Set(
      completed.map((d) => (d.email || "").trim().toLowerCase())
    ).size;
    const pendingList = donors.filter((d) =>
      (d.status || "").startsWith("pending")
    );
    return {
      cop,
      usd,
      confirmed: completed.length,
      bold: completed.filter((d) => d.provider === "bold").length,
      paypal: completed.filter((d) => d.provider !== "bold").length,
      pending: pendingList.length,
      pendingCop: pendingList
        .filter((d) => currencyOf(d) === "COP")
        .reduce((s, d) => s + (Number(d.amount) || 0), 0),
      people,
      total: donors.length,
    };
  }, [donors]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return donors.filter((d) => {
      const matchStatus =
        status === "all" ||
        (status === "pending"
          ? (d.status || "").startsWith("pending")
          : d.status === status);
      const matchMethod = method === "all" || (d.provider || "paypal") === method;
      const haystack = `${d.name || ""} ${d.email || ""}`.toLowerCase();
      return matchStatus && matchMethod && (!term || haystack.includes(term));
    });
  }, [donors, search, status, method]);

  const downloadCsv = () => {
    const headers = [
      "Nombre",
      "Correo",
      "Telefono",
      "Pais",
      "Monto",
      "Moneda",
      "Metodo",
      "Estado",
      "Fecha",
      "Mensaje",
    ];
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    donors.forEach((d) => {
      lines.push(
        [
          d.name,
          d.email,
          d.phone,
          d.countryName || d.country,
          d.amount,
          d.currency || "COP",
          d.provider || "paypal",
          d.status,
          d.created_at,
          d.message,
        ]
          .map(esc)
          .join(",")
      );
    });
    const blob = new Blob(["﻿" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aportes-afroin.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="text-foreground">
      {/* Header */}
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Aportes recibidos
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Movimiento un Millón de Corazones
          </p>
        </div>
        <span className="text-muted-foreground text-sm">
          Actualizado · {formatDate(generatedAt)}
        </span>
      </header>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          hero
          icon={<DollarSign className="size-5" />}
          label="Total recaudado"
          action={
            <button
              type="button"
              onClick={() => setHideTotals((v) => !v)}
              className="text-white/60 hover:text-white"
              aria-label="Mostrar u ocultar"
            >
              {hideTotals ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          }
        >
          <div className={cn(hideTotals && "blur-sm select-none")}>
            <p className="text-2xl leading-tight font-extrabold">
              {formatCurrency(stats.cop, "COP")}
            </p>
            <p className="text-sm leading-tight font-semibold text-white/70">
              + {formatCurrency(stats.usd, "USD")}
              <span className="text-white/40"> · PayPal</span>
            </p>
          </div>
        </StatCard>

        <StatCard
          icon={<Users className="size-5" />}
          label="Personas unidas"
          hint={
            <div>
              <div className="flex items-center justify-between">
                <span>Meta · Un Millón de Corazones</span>
                <span className="tabular-nums">
                  {((stats.people / GOAL) * 100).toFixed(4)}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e31c25]/10">
                <div
                  className="h-full rounded-full bg-[#e31c25]"
                  style={{
                    width: `${Math.max(2, (stats.people / GOAL) * 100)}%`,
                  }}
                />
              </div>
            </div>
          }
        >
          <p className="text-3xl font-extrabold">
            {stats.people.toLocaleString("es-CO")}
            <span className="text-muted-foreground ml-1 text-base font-semibold">
              / 1.000.000
            </span>
          </p>
        </StatCard>

        <StatCard
          icon={<CheckCircle2 className="size-5" />}
          label="Aportes exitosos"
          hint={
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-[#e31c25]" /> Bold{" "}
                {stats.bold}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-[#003087]" /> PayPal{" "}
                {stats.paypal}
              </span>
            </span>
          }
        >
          <p className="text-3xl font-extrabold">{stats.confirmed}</p>
        </StatCard>

        <StatCard
          icon={<Clock className="size-5" />}
          label="Pendientes"
          hint={
            stats.pending > 0 ? (
              <span className="font-semibold text-amber-600">
                {stats.pendingCop > 0
                  ? `${formatCurrency(stats.pendingCop, "COP")} por confirmar`
                  : "Por confirmar"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                <CheckCircle2 className="size-3" /> Todo al día
              </span>
            )
          }
        >
          <p className="text-3xl font-extrabold">{stats.pending}</p>
        </StatCard>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo"
            className="border-border bg-white pl-9 shadow-sm"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="border-border w-[180px] bg-white shadow-sm">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="completed">Completados</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="rejected">Rechazados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="border-border w-[160px] bg-white shadow-sm">
            <SelectValue placeholder="Método" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los métodos</SelectItem>
            <SelectItem value="bold">Bold (COP)</SelectItem>
            <SelectItem value="paypal">PayPal (USD)</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={downloadCsv}
          className="bg-white shadow-sm"
        >
          <Download /> Descargar
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="py-4 pl-6">Donante</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="pr-6 text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground py-12 text-center"
                >
                  No hay aportes que coincidan con el filtro.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d, i) => (
                <TableRow
                  key={d.id ?? i}
                  className="cursor-pointer"
                  onClick={() => setSelected(d)}
                >
                  <TableCell className="py-4 pl-6">
                    <div className="flex items-center gap-3">
                      <span className="flex w-7 shrink-0 items-center justify-center">
                        <PaymentIcon provider={d.provider} />
                      </span>
                      <span className="flex flex-col">
                        <span className="text-foreground font-semibold">
                          {d.name}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {d.countryEmoji ? `${d.countryEmoji} ` : ""}
                          {d.provider === "bold" ? "Bold" : "PayPal"}
                          {d.country ? ` · ${d.country}` : ""}
                        </span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{d.email}</span>
                      {d.phone ? (
                        <span className="text-muted-foreground text-xs">
                          {d.phone}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(d.created_at)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={d.status} />
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="font-extrabold">
                        {formatCurrency(d.amount, currencyOf(d))}
                      </span>
                      <ChevronRight className="text-muted-foreground size-4" />
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <p className="text-muted-foreground mt-3 text-sm">
        {filtered.length} de {donors.length} aportes
      </p>

      {/* Detail dialog */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent>
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PaymentIcon provider={selected.provider} />
                  {formatCurrency(selected.amount, currencyOf(selected))}
                </DialogTitle>
                <DialogDescription>
                  {statusInfo(selected.status).title} ·{" "}
                  {selected.provider === "bold" ? "Bold" : "PayPal"}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-2">
                <DetailRow label="Nombre" value={selected.name} />
                <DetailRow label="Correo" value={selected.email} />
                <DetailRow label="Teléfono" value={selected.phone} />
                <DetailRow
                  label="País"
                  value={
                    selected.countryEmoji
                      ? `${selected.countryEmoji} ${selected.countryName || selected.country}`
                      : selected.country
                  }
                />
                <DetailRow
                  label="Estado"
                  value={<StatusBadge status={selected.status} />}
                />
                <DetailRow
                  label="Estado proveedor"
                  value={selected.provider_status}
                />
                <DetailRow label="Creado" value={formatDate(selected.created_at)} />
                <DetailRow
                  label="Confirmado"
                  value={
                    selected.completed_at
                      ? formatDate(selected.completed_at)
                      : undefined
                  }
                />
                <DetailRow
                  label="ID transacción"
                  value={selected.transaction_id}
                />
                <DetailRow label="Orden Bold" value={selected.bold_order_id} />
                <DetailRow
                  label="Mensaje"
                  value={
                    selected.message ? (
                      <span className="italic">“{selected.message}”</span>
                    ) : undefined
                  }
                />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
