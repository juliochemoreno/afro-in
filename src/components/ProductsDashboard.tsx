"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, Search, Package } from "lucide-react";

import type { ColDef } from "ag-grid-community";
import AdminGrid from "@/components/admin/AdminGrid";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type ProductRow } from "@/components/admin/productTypes";

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

// --- AG Grid cell renderers ---
function ProductCell(p: any) {
  const d = p.data as ProductRow;
  const img = d.images?.[0]?.url;
  return (
    <div className="flex h-full items-center gap-3">
      <div className="bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">
        {img ? (
          <img src={img} alt="" className="size-full object-cover" />
        ) : (
          <Package className="text-muted-foreground size-4" />
        )}
      </div>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-foreground truncate font-semibold">
          {d.name_es}
        </span>
        <span className="text-muted-foreground truncate text-xs">{d.slug}</span>
      </div>
    </div>
  );
}

// Inline-editable boolean flag (in_stock / visible / featured). The column's
// `field` selects which flag this cell edits.
function ToggleCell(p: any) {
  const field = p.colDef?.field as string;
  const checked = !!p.data?.[field];
  return (
    <div className="flex h-full items-center">
      <Switch
        checked={checked}
        onCheckedChange={(v) => p.context.onToggle(p.data.id, field, v)}
        aria-label={field}
      />
    </div>
  );
}

function ActionsCell(p: any) {
  const d = p.data as ProductRow;
  const { remove } = p.context;
  return (
    <div className="flex h-full items-center justify-end gap-1">
      <Button asChild variant="ghost" size="icon-sm" aria-label="Editar">
        <a href={`/admin/productos/${d.id}`}>
          <Pencil className="size-4" />
        </a>
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => remove(d)}
        aria-label="Eliminar"
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export default function ProductsDashboard() {
  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  const fetchProducts = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products");
      if (res.ok) {
        const data = (await res.json()) as { products: ProductRow[] };
        setProducts(data.products || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const remove = async (p: ProductRow) => {
    if (!confirm(`¿Eliminar "${p.name_es}"? Esta acción no se puede deshacer.`))
      return;
    const res = await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
    if (res.ok) await fetchProducts();
  };

  // Optimistic inline toggle of a flag; revert by refetching on failure.
  const onToggle = async (id: number, field: string, value: boolean) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value ? 1 : 0 } : p))
    );
    const res = await fetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) await fetchProducts();
  };

  const columnDefs = React.useMemo<ColDef<ProductRow>[]>(
    () => [
      {
        headerName: "Producto",
        field: "name_es",
        flex: 2,
        minWidth: 240,
        cellRenderer: ProductCell,
      },
      { headerName: "SKU", field: "sku", width: 160 },
      { headerName: "Categoría", field: "category_es", width: 150 },
      {
        headerName: "Precio",
        field: "price",
        width: 140,
        type: "rightAligned",
        valueFormatter: (p) =>
          p.value != null ? COP.format(Number(p.value)) : "",
      },
      {
        headerName: "En stock",
        field: "in_stock",
        width: 120,
        filter: false,
        cellRenderer: ToggleCell,
      },
      {
        headerName: "Visible",
        field: "visible",
        width: 110,
        filter: false,
        cellRenderer: ToggleCell,
      },
      {
        headerName: "Destacado",
        field: "featured",
        width: 120,
        filter: false,
        cellRenderer: ToggleCell,
      },
      {
        headerName: "",
        colId: "actions",
        width: 110,
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
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Productos</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gestiona el catálogo de la tienda
          </p>
        </div>
        <Button asChild className="gap-2">
          <a href="/admin/productos/nuevo">
            <Plus className="size-4" /> Nuevo producto
          </a>
        </Button>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU o slug"
            className="border-border bg-background pl-9 shadow-sm"
          />
        </div>
        <span className="text-muted-foreground text-sm">
          {products.length} producto{products.length === 1 ? "" : "s"}
        </span>
      </div>

      <AdminGrid<ProductRow>
        rowData={products}
        columnDefs={columnDefs}
        quickFilterText={search}
        context={{ remove, onToggle }}
        loading={loading}
        rowHeight={56}
        overlayNoRowsTemplate="No hay productos."
      />
    </div>
  );
}
