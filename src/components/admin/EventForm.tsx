"use client";

import * as React from "react";
import { X, Upload, Loader2, Eye, ArrowLeft, CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Locale = "es" | "en" | "fr";
const LOCALES: Locale[] = ["es", "en", "fr"];
const FLAG: Record<Locale, string> = { es: "🇪🇸", en: "🇬🇧", fr: "🇫🇷" };

export interface EventRow {
  id?: number;
  slug: string;
  name_es: string;
  name_en?: string | null;
  name_fr?: string | null;
  description_es?: string | null;
  description_en?: string | null;
  description_fr?: string | null;
  venue?: string | null;
  city?: string | null;
  event_date: string;
  price: number | string;
  capacity: number | string;
  image_r2_key?: string | null;
  visible?: number | boolean;
}

interface FormState {
  id?: number;
  slug: string;
  name_es: string;
  name_en: string;
  name_fr: string;
  description_es: string;
  description_en: string;
  description_fr: string;
  venue: string;
  city: string;
  event_date: string;
  price: string;
  capacity: string;
  image_r2_key: string | null;
  image_url: string | null;
  visible: boolean;
}

const EMPTY: FormState = {
  slug: "",
  name_es: "",
  name_en: "",
  name_fr: "",
  description_es: "",
  description_en: "",
  description_fr: "",
  venue: "",
  city: "",
  event_date: "",
  price: "",
  capacity: "",
  image_r2_key: null,
  image_url: null,
  visible: true,
};

function toForm(e: EventRow): FormState {
  return {
    id: e.id,
    slug: e.slug || "",
    name_es: e.name_es || "",
    name_en: e.name_en || "",
    name_fr: e.name_fr || "",
    description_es: e.description_es || "",
    description_en: e.description_en || "",
    description_fr: e.description_fr || "",
    venue: e.venue || "",
    city: e.city || "",
    event_date: e.event_date || "",
    price: e.price != null ? String(e.price) : "",
    capacity: e.capacity != null ? String(e.capacity) : "",
    image_r2_key: e.image_r2_key || null,
    image_url: e.image_r2_key ? `/media/${e.image_r2_key}` : null,
    visible: e.visible == null ? true : !!e.visible,
  };
}

export default function EventForm({ event }: { event: EventRow | null }) {
  const initial = React.useMemo(() => (event ? toForm(event) : EMPTY), [event]);
  const [form, setForm] = React.useState<FormState>(initial);
  const snapshot = React.useRef(JSON.stringify(initial));
  const [lang, setLang] = React.useState<Locale>("es");
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const getL = (base: "name" | "description") =>
    (form[`${base}_${lang}` as keyof FormState] as string) ?? "";
  const setL = (base: "name" | "description", v: string) =>
    set(`${base}_${lang}` as keyof FormState, v as any);

  const isDirty = JSON.stringify(form) !== snapshot.current;

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", form.slug || "misc");
      const res = await fetch("/api/admin/events/upload", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        setError(data.error || "No se pudo subir la imagen");
        return;
      }
      setForm((f) => ({ ...f, image_r2_key: data.r2_key, image_url: data.url }));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        capacity: Number(form.capacity),
      };
      const url = form.id
        ? `/api/admin/events/${form.id}`
        : "/api/admin/events";
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
      window.location.href = "/admin/eventos";
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setSaving(false);
    }
  };

  return (
    <div className="text-foreground w-full px-6 py-6 pb-28">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <a
            href="/admin/eventos"
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors"
            aria-label="Volver"
          >
            <ArrowLeft className="size-5" />
          </a>
          <div className="min-w-0">
            <p className="text-muted-foreground truncate text-sm">
              Eventos / {event ? form.name_es || "Evento" : "Nuevo evento"}
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {event ? "Editar evento" : "Nuevo evento"}
            </h1>
          </div>
        </div>

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información</CardTitle>
              <CardDescription>Nombre, descripción y lugar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Slug (URL)" htmlFor="e-slug">
                <Input
                  id="e-slug"
                  value={form.slug}
                  onChange={(e) =>
                    set(
                      "slug",
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")
                    )
                  }
                  placeholder="afro-in-palenque-2026"
                />
              </Field>
              <Field label="Nombre" htmlFor="e-name">
                <Input
                  id="e-name"
                  value={getL("name")}
                  onChange={(e) => setL("name", e.target.value)}
                />
              </Field>
              <Field label="Descripción" htmlFor="e-desc">
                <Textarea
                  id="e-desc"
                  rows={4}
                  value={getL("description")}
                  onChange={(e) => setL("description", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Lugar" htmlFor="e-venue">
                  <Input
                    id="e-venue"
                    value={form.venue}
                    onChange={(e) => set("venue", e.target.value)}
                    placeholder="Casa de la Cultura"
                  />
                </Field>
                <Field label="Ciudad" htmlFor="e-city">
                  <Input
                    id="e-city"
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    placeholder="Cartagena"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Medios</CardTitle>
              <CardDescription>webp/jpeg/png, máx. 800 KB.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {form.image_url ? (
                  <div className="border-border relative size-32 overflow-hidden rounded-lg border">
                    <img
                      src={form.image_url}
                      alt=""
                      className="size-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          image_r2_key: null,
                          image_url: null,
                        }))
                      }
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                      aria-label="Quitar imagen"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="border-border text-muted-foreground hover:border-primary hover:text-primary flex size-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs"
                  >
                    {uploading ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <Upload className="size-5" />
                    )}
                    Subir
                  </button>
                )}
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

        <div className="order-first space-y-6 lg:order-none">
          <Card>
            <CardHeader>
              <CardTitle>Fecha y cupo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Fecha y hora" htmlFor="e-date">
                <Input
                  id="e-date"
                  type="datetime-local"
                  value={form.event_date}
                  onChange={(e) => set("event_date", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Precio COP" htmlFor="e-price">
                  <Input
                    id="e-price"
                    type="number"
                    value={form.price}
                    onChange={(e) => set("price", e.target.value)}
                    placeholder="50000"
                  />
                </Field>
                <Field label="Cupo" htmlFor="e-cap">
                  <Input
                    id="e-cap"
                    type="number"
                    value={form.capacity}
                    onChange={(e) => set("capacity", e.target.value)}
                    placeholder="100"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex cursor-pointer items-center justify-between gap-3 py-2 text-sm font-medium">
                <span className="text-foreground inline-flex items-center gap-2">
                  <span
                    className={cn(
                      form.visible ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <Eye className="size-4" />
                  </span>
                  Visible al público
                </span>
                <Switch
                  checked={form.visible}
                  onCheckedChange={(v) => set("visible", v)}
                />
              </label>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="bg-background/95 sticky bottom-0 z-10 -mx-6 mt-6 flex items-center justify-end gap-3 border-t px-6 py-3 backdrop-blur">
        {error ? (
          <p className="bg-destructive/10 text-destructive mr-auto rounded-md px-3 py-1.5 text-sm font-medium">
            {error}
          </p>
        ) : null}
        <Button asChild variant="outline">
          <a href="/admin/eventos">Cancelar</a>
        </Button>
        <Button
          onClick={save}
          disabled={saving || (!!event && !isDirty)}
          className="gap-2"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CalendarDays className="size-4" />
          )}
          {event ? "Guardar cambios" : "Crear evento"}
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
