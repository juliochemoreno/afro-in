"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TaxType = "categories" | "tags" | "sizes" | "colors";

interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "number" | "slug" | "color";
}

const TABS: { type: TaxType; label: string }[] = [
  { type: "categories", label: "Categorías" },
  { type: "tags", label: "Etiquetas" },
  { type: "sizes", label: "Tallas" },
  { type: "colors", label: "Colores" },
];

const ML: FieldDef[] = [
  { key: "slug", label: "Slug", type: "slug" },
  { key: "name_es", label: "Nombre (ES)" },
  { key: "name_en", label: "Nombre (EN)" },
  { key: "name_fr", label: "Nombre (FR)" },
  { key: "sort_order", label: "Orden", type: "number" },
];

const FIELDS: Record<TaxType, FieldDef[]> = {
  categories: ML,
  tags: ML,
  sizes: [
    { key: "label", label: "Etiqueta (S, M, 42…)" },
    { key: "sort_order", label: "Orden", type: "number" },
  ],
  colors: [
    { key: "slug", label: "Slug", type: "slug" },
    { key: "name_es", label: "Nombre (ES)" },
    { key: "name_en", label: "Nombre (EN)" },
    { key: "name_fr", label: "Nombre (FR)" },
    { key: "hex", label: "Color", type: "color" },
    { key: "sort_order", label: "Orden", type: "number" },
  ],
};

const defaults = (t: TaxType): any => {
  const o: any = {};
  FIELDS[t].forEach((f) => {
    o[f.key] = f.type === "number" ? "0" : f.type === "color" ? "#000000" : "";
  });
  return o;
};

export default function TaxonomyManager() {
  const [active, setActive] = React.useState<TaxType>("categories");
  const [data, setData] = React.useState<Record<TaxType, any[]>>({
    categories: [],
    tags: [],
    sizes: [],
    colors: [],
  });
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<any>(null);
  const [form, setForm] = React.useState<any>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (type: TaxType) => {
    const r = await fetch(`/api/admin/taxonomy/${type}`);
    if (r.ok) {
      const d = (await r.json()) as { items: any[] };
      setData((p) => ({ ...p, [type]: d.items || [] }));
    }
  }, []);

  React.useEffect(() => {
    load(active);
  }, [active, load]);

  const openNew = () => {
    setEditing(null);
    setForm(defaults(active));
    setError(null);
    setOpen(true);
  };
  const openEdit = (row: any) => {
    setEditing(row);
    setForm({ ...row });
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const url = editing
        ? `/api/admin/taxonomy/${active}/${editing.id}`
        : `/api/admin/taxonomy/${active}`;
      const r = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = (await r.json()) as any;
      if (!r.ok) {
        setError(d.error || "No se pudo guardar");
        return;
      }
      setOpen(false);
      await load(active);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: any) => {
    if (!confirm(`¿Eliminar "${row.name_es || row.label}"?`)) return;
    const r = await fetch(`/api/admin/taxonomy/${active}/${row.id}`, {
      method: "DELETE",
    });
    if (r.ok) await load(active);
  };

  return (
    <div className="text-foreground flex h-full min-h-0 flex-col gap-4 p-6">
      <header className="flex shrink-0 items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Atributos</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Categorías, etiquetas, tallas y colores de la tienda
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="size-4" /> Nuevo
        </Button>
      </header>

      <Tabs
        value={active}
        onValueChange={(v) => setActive(v as TaxType)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="shrink-0">
          {TABS.map((t) => (
            <TabsTrigger key={t.type} value={t.type}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent
            key={t.type}
            value={t.type}
            className="mt-3 min-h-0 flex-1 overflow-y-auto"
          >
            <Card className="gap-0 divide-y py-0">
              {data[t.type].length === 0 ? (
                <p className="text-muted-foreground p-8 text-center text-sm">
                  Sin elementos. Crea el primero con “Nuevo”.
                </p>
              ) : (
                data[t.type].map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {t.type === "colors" ? (
                        <span
                          className="border-border size-5 shrink-0 rounded-full border"
                          style={{ background: row.hex || "#ccc" }}
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {row.name_es || row.label}
                        </p>
                        {row.slug ? (
                          <p className="text-muted-foreground truncate text-xs">
                            {row.slug}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(row)}
                        aria-label="Editar"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(row)}
                        aria-label="Eliminar"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar" : "Nuevo"} ·{" "}
              {TABS.find((t) => t.type === active)?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {FIELDS[active].map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs">{f.label}</Label>
                {f.type === "color" ? (
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={form.hex || "#000000"}
                      onChange={(e) =>
                        setForm((p: any) => ({ ...p, hex: e.target.value }))
                      }
                      className="border-border h-9 w-12 rounded border"
                    />
                    <Input
                      value={form.hex || ""}
                      onChange={(e) =>
                        setForm((p: any) => ({ ...p, hex: e.target.value }))
                      }
                      placeholder="#000000"
                    />
                  </div>
                ) : (
                  <Input
                    type={f.type === "number" ? "number" : "text"}
                    value={form[f.key] ?? ""}
                    onChange={(e) =>
                      setForm((p: any) => ({
                        ...p,
                        [f.key]:
                          f.type === "slug"
                            ? e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9-]/g, "-")
                            : e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}
            {error ? (
              <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm font-medium">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
