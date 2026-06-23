"use client";

import * as React from "react";
import { X, Upload, Loader2, Eye, Package, Star, ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ProductRow,
  type FormState,
  EMPTY_PRODUCT,
  productToForm,
} from "./productTypes";

type Locale = "es" | "en" | "fr";
const LOCALES: Locale[] = ["es", "en", "fr"];
const FLAG: Record<Locale, string> = { es: "🇪🇸", en: "🇬🇧", fr: "🇫🇷" };

interface Taxonomies {
  categories: any[];
  tags: any[];
  sizes: any[];
  colors: any[];
}

export default function ProductForm({
  product,
  taxonomies,
  relations,
}: {
  product: ProductRow | null;
  taxonomies: Taxonomies;
  relations: { tags: number[]; sizes: number[]; colors: number[] };
}) {
  const initialForm = React.useMemo(
    () => (product ? productToForm(product) : EMPTY_PRODUCT),
    [product]
  );
  const [form, setForm] = React.useState<FormState>(initialForm);
  const [categoryId, setCategoryId] = React.useState<string>(
    product?.category_id ? String(product.category_id) : ""
  );
  const [tagIds, setTagIds] = React.useState<number[]>(relations?.tags || []);
  const [sizeIds, setSizeIds] = React.useState<number[]>(relations?.sizes || []);
  const [colorIds, setColorIds] = React.useState<number[]>(
    relations?.colors || []
  );
  const initialSnapshot = React.useRef(
    JSON.stringify({
      form: initialForm,
      categoryId: product?.category_id ? String(product.category_id) : "",
      tagIds: relations?.tags || [],
      sizeIds: relations?.sizes || [],
      colorIds: relations?.colors || [],
    })
  );
  const [lang, setLang] = React.useState<Locale>("es");
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Localized field helpers driven by the single global language switcher.
  const getL = (base: "name" | "description") =>
    (form[`${base}_${lang}` as keyof FormState] as string) ?? "";
  const setL = (base: "name" | "description", v: string) =>
    set(`${base}_${lang}` as keyof FormState, v as any);

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<number[]>>,
    id: number
  ) =>
    setter((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const isDirty =
    JSON.stringify({ form, categoryId, tagIds, sizeIds, colorIds }) !==
    initialSnapshot.current;

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", form.slug || "misc");
      const res = await fetch("/api/admin/products/upload", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        setError(data.error || "No se pudo subir la imagen");
        return;
      }
      setForm((f) => ({
        ...f,
        images: [
          ...f.images,
          { r2_key: data.r2_key, content_type: data.content_type, url: data.url },
        ],
      }));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeImage = (idx: number) =>
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        price_usd: form.price_usd ? Number(form.price_usd) : null,
        sort_order: Number(form.sort_order) || 0,
        category_id: categoryId ? Number(categoryId) : null,
        tag_ids: tagIds,
        size_ids: sizeIds,
        color_ids: colorIds,
        images: form.images.map((i) => ({
          r2_key: i.r2_key,
          content_type: i.content_type,
          alt: form.name_es,
        })),
      };
      const url = form.id
        ? `/api/admin/products/${form.id}`
        : "/api/admin/products";
      const res = await fetch(url, {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        setError(data.error || "No se pudo guardar");
        setSaving(false);
        return;
      }
      window.location.href = "/admin/productos";
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setSaving(false);
    }
  };

  return (
    <div className="text-foreground w-full px-6 py-6 pb-28">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <a
            href="/admin/productos"
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors"
            aria-label="Volver"
          >
            <ArrowLeft className="size-5" />
          </a>
          <div className="min-w-0">
            <p className="text-muted-foreground truncate text-sm">
              Productos /{" "}
              {product ? form.name_es || "Producto" : "Nuevo producto"}
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {product ? "Editar producto" : "Nuevo producto"}
            </h1>
          </div>
        </div>

        {/* Single global language switcher with flags */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground hidden text-xs font-medium sm:inline">
            Idioma
          </span>
          <Tabs value={lang} onValueChange={(v) => setLang(v as Locale)}>
            <TabsList>
              {LOCALES.map((l) => (
                <TabsTrigger key={l} value={l} className="gap-1.5 px-2.5">
                  <span className="text-base leading-none">{FLAG[l]}</span>
                  <span className="uppercase">{l}</span>
                  {l !== "es" &&
                  !(form[`name_${l}` as keyof FormState] as string) ? (
                    <span className="size-1.5 rounded-full bg-amber-500" />
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Two-column editor */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* MAIN */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información</CardTitle>
              <CardDescription>
                Identidad, nombre y descripción del producto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Slug (URL)" htmlFor="f-slug">
                  <Input
                    id="f-slug"
                    value={form.slug}
                    onChange={(e) =>
                      set(
                        "slug",
                        e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")
                      )
                    }
                    placeholder="camiseta-afroin"
                  />
                </Field>
                <Field label="SKU" htmlFor="f-sku">
                  <Input
                    id="f-sku"
                    value={form.sku}
                    onChange={(e) => set("sku", e.target.value)}
                    placeholder="AFR-ROP-XXX"
                  />
                </Field>
              </div>

              <Field label="Nombre" htmlFor="f-name">
                <Input
                  id="f-name"
                  value={getL("name")}
                  onChange={(e) => setL("name", e.target.value)}
                />
              </Field>
              <Field label="Descripción" htmlFor="f-desc">
                <Textarea
                  id="f-desc"
                  rows={4}
                  value={getL("description")}
                  onChange={(e) => setL("description", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Precios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Precio COP" htmlFor="f-price">
                  <Input
                    id="f-price"
                    type="number"
                    value={form.price}
                    onChange={(e) => set("price", e.target.value)}
                    placeholder="89900"
                  />
                </Field>
                <Field label="Precio USD (ref.)" htmlFor="f-priceusd">
                  <Input
                    id="f-priceusd"
                    type="number"
                    value={form.price_usd}
                    onChange={(e) => set("price_usd", e.target.value)}
                    placeholder="23"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Medios</CardTitle>
              <CardDescription>
                webp/jpeg/png, máx. 800 KB. La primera imagen es la principal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {form.images.map((img, idx) => (
                  <div
                    key={img.r2_key}
                    className="border-border relative size-24 overflow-hidden rounded-lg border"
                  >
                    <img src={img.url} alt="" className="size-full object-cover" />
                    {idx === 0 ? (
                      <span className="bg-primary text-primary-foreground absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-bold">
                        Principal
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                      aria-label="Quitar imagen"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="border-border text-muted-foreground hover:border-primary hover:text-primary flex size-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs"
                >
                  {uploading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Upload className="size-5" />
                  )}
                  Subir
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/webp,image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SIDEBAR */}
        <div className="order-first space-y-6 lg:order-none">
          <Card>
            <CardHeader>
              <CardTitle>Estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <SwitchRow
                checked={form.visible}
                onChange={(v) => set("visible", v)}
                icon={<Eye className="size-4" />}
                label="Visible en la tienda"
              />
              <Separator />
              <SwitchRow
                checked={form.in_stock}
                onChange={(v) => set("in_stock", v)}
                icon={<Package className="size-4" />}
                label="En stock"
              />
              <Separator />
              <SwitchRow
                checked={form.featured}
                onChange={(v) => set("featured", v)}
                icon={<Star className="size-4" />}
                label="Destacado"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organización</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Categoría">
                <Select
                  value={categoryId || "none"}
                  onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {taxonomies.categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name_es}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Separator />

              <Field label="Etiquetas">
                <Chips
                  options={taxonomies.tags}
                  selected={tagIds}
                  onToggle={(id) => toggle(setTagIds, id)}
                  getLabel={(o) => o.name_es}
                  emptyHint="Crea etiquetas en Atributos."
                />
              </Field>
              <Field label="Tallas">
                <Chips
                  options={taxonomies.sizes}
                  selected={sizeIds}
                  onToggle={(id) => toggle(setSizeIds, id)}
                  getLabel={(o) => o.label}
                  emptyHint="Crea tallas en Atributos."
                />
              </Field>
              <Field label="Colores">
                <Chips
                  options={taxonomies.colors}
                  selected={colorIds}
                  onToggle={(id) => toggle(setColorIds, id)}
                  getLabel={(o) => o.name_es}
                  getColor={(o) => o.hex}
                  emptyHint="Crea colores en Atributos."
                />
              </Field>

              <Separator />

              <Field label="Orden" htmlFor="f-order">
                <Input
                  id="f-order"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => set("sort_order", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="bg-background/95 sticky bottom-0 z-10 -mx-6 mt-6 flex items-center justify-end gap-3 border-t px-6 py-3 backdrop-blur">
        {error ? (
          <p className="bg-destructive/10 text-destructive mr-auto rounded-md px-3 py-1.5 text-sm font-medium">
            {error}
          </p>
        ) : null}
        <Button asChild variant="outline">
          <a href="/admin/productos">Cancelar</a>
        </Button>
        <Button
          onClick={save}
          disabled={saving || (!!product && !isDirty)}
          className="gap-2"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {product ? "Guardar cambios" : "Crear producto"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SwitchRow({
  checked,
  onChange,
  icon,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-2 text-sm font-medium">
      <span className="text-foreground inline-flex items-center gap-2">
        <span className={cn(checked ? "text-primary" : "text-muted-foreground")}>
          {icon}
        </span>
        {label}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function Chips({
  options,
  selected,
  onToggle,
  getLabel,
  getColor,
  emptyHint,
}: {
  options: any[];
  selected: number[];
  onToggle: (id: number) => void;
  getLabel: (o: any) => string;
  getColor?: (o: any) => string | undefined;
  emptyHint?: string;
}) {
  if (!options || options.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        {emptyHint || "Sin opciones."}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button
            type="button"
            key={o.id}
            onClick={() => onToggle(o.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
              on
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {getColor ? (
              <span
                className="size-3 rounded-full border"
                style={{ background: getColor(o) || "#ccc" }}
              />
            ) : null}
            {getLabel(o)}
          </button>
        );
      })}
    </div>
  );
}
