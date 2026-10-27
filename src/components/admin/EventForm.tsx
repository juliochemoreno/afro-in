"use client";

import * as React from "react";
import {
  X,
  Upload,
  Loader2,
  Eye,
  ArrowLeft,
  CalendarDays,
  RefreshCw,
  MapPin,
  Clock,
  Search,
  Check,
} from "lucide-react";

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

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function formatTimeAmPm(timeStr: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

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
  department?: string | null;
  country?: string | null;
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
  department: string;
  country: string;
  event_date: string;
  price: string;
  is_free: boolean;
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
  department: "",
  country: "Colombia",
  event_date: "",
  price: "",
  is_free: false,
  capacity: "",
  image_r2_key: null,
  image_url: null,
  visible: true,
};

function toForm(e: EventRow): FormState {
  const p = e.price != null ? Number(e.price) : 0;
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
    department: e.department || "",
    country: e.country || "Colombia",
    event_date: e.event_date || "",
    price: e.price != null ? String(e.price) : "",
    is_free: p === 0 && e.id != null,
    capacity: e.capacity != null ? String(e.capacity) : "",
    image_r2_key: e.image_r2_key || null,
    image_url: e.image_r2_key ? `/media/${e.image_r2_key}` : null,
    visible: e.visible == null ? true : !!e.visible,
  };
}

export default function EventForm({
  event,
  googleMapsApiKey,
}: {
  event: EventRow | null;
  googleMapsApiKey?: string;
}) {
  const initial = React.useMemo(() => (event ? toForm(event) : EMPTY), [event]);
  const [form, setForm] = React.useState<FormState>(initial);
  const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(Boolean(event?.slug));
  const snapshot = React.useRef(JSON.stringify(initial));
  const [lang, setLang] = React.useState<Locale>("es");
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Date and Time split helpers
  const [datePart, setDatePart] = React.useState(() => {
    if (initial.event_date) {
      return initial.event_date.split("T")[0] || "";
    }
    return "";
  });
  const [timePart, setTimePart] = React.useState(() => {
    if (initial.event_date) {
      const t = initial.event_date.split("T")[1];
      return t ? t.slice(0, 5) : "20:00";
    }
    return "20:00";
  });

  const updateDateTime = (newDate: string, newTime: string) => {
    setDatePart(newDate);
    setTimePart(newTime);
    if (newDate) {
      set("event_date", `${newDate}T${newTime || "20:00"}`);
    } else {
      set("event_date", "");
    }
  };

  // Google Places (New API) & Geo Search Autocomplete
  const [geoQuery, setGeoQuery] = React.useState("");
  const [geoSuggestions, setGeoSuggestions] = React.useState<any[]>([]);
  const [searchingGeo, setSearchingGeo] = React.useState(false);
  const searchTimeoutRef = React.useRef<any>(null);

  const apiKey =
    googleMapsApiKey ||
    (import.meta as any).env?.PUBLIC_GOOGLE_MAPS_API_KEY ||
    (typeof window !== "undefined" ? (window as any).GOOGLE_MAPS_API_KEY : "");

  // Autocomplete search supporting Google Places API (New) + Photon fallback
  const handleGeoQuery = (query: string) => {
    setGeoQuery(query);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query || query.trim().length < 3) {
      setGeoSuggestions([]);
      setSearchingGeo(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchingGeo(true);
      try {
        if (apiKey) {
          // Use Places API (New) Autocomplete
          const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
            },
            body: JSON.stringify({
              input: query,
              includedRegionCodes: ["co"],
            }),
          });

          if (res.ok) {
            const data = (await res.json()) as any;
            if (data.suggestions && data.suggestions.length > 0) {
              const suggestions = data.suggestions.map((s: any) => {
                const pred = s.placePrediction;
                return {
                  placeId: pred?.placeId,
                  name: pred?.structuredFormat?.mainText?.text || pred?.text?.text || query,
                  description:
                    pred?.structuredFormat?.secondaryText?.text ||
                    pred?.text?.text ||
                    "",
                  source: "google",
                };
              });
              setGeoSuggestions(suggestions);
              return;
            }
          }
        }

        // Fallback to Photon / OpenStreetMap if Google API fails or has no results
        const q = query.toLowerCase().includes("colombia") ? query : `${query}, Colombia`;
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`
        );
        if (res.ok) {
          const data = (await res.json()) as any;
          const results = (data.features || []).map((f: any) => {
            const p = f.properties || {};
            return {
              name: p.name || query,
              city: p.city || p.town || p.district || "",
              department: p.state || "",
              country: p.country || "Colombia",
              description: [p.city || p.town, p.state, p.country]
                .filter(Boolean)
                .join(", "),
              source: "photon",
            };
          });
          setGeoSuggestions(results);
        }
      } catch (err) {
        console.warn("Error buscando lugares:", err);
      } finally {
        setSearchingGeo(false);
      }
    }, 300);
  };

  const selectGeoSuggestion = async (item: any) => {
    setSearchingGeo(true);
    setGeoSuggestions([]);
    setGeoQuery(item.name);

    if (item.source === "google" && item.placeId && apiKey) {
      try {
        const res = await fetch(
          `https://places.googleapis.com/v1/places/${item.placeId}?fields=id,displayName,formattedAddress,addressComponents`,
          {
            headers: {
              "X-Goog-Api-Key": apiKey,
            },
          }
        );
        if (res.ok) {
          const details = (await res.json()) as any;
          let city = "";
          let department = "";
          let country = "Colombia";

          if (details.addressComponents) {
            for (const c of details.addressComponents) {
              const types = c.types || [];
              if (types.includes("locality") || types.includes("sublocality")) {
                city = c.longText || c.shortText || "";
              }
              if (types.includes("administrative_area_level_1")) {
                department = c.longText || c.shortText || "";
              }
              if (types.includes("country")) {
                country = c.longText || c.shortText || "Colombia";
              }
            }
          }

          const venueName = details.displayName?.text || item.name;
          setForm((f) => ({
            ...f,
            venue: venueName,
            city: city || f.city,
            department: department || f.department,
            country: country || f.country,
          }));
          setSearchingGeo(false);
          return;
        }
      } catch (err) {
        console.warn("Error fetching place details:", err);
      }
    }

    // Fallback or Photon assignment
    setForm((f) => ({
      ...f,
      venue: item.name || f.venue,
      city: item.city || f.city,
      department: item.department || f.department,
      country: item.country || f.country,
    }));
    setSearchingGeo(false);
  };

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
      if (!form.is_free && Number(form.price) < 1500) {
        setError("El precio mínimo para eventos pagos es 1.500 COP (o marca la casilla de evento gratuito).");
        setSaving(false);
        return;
      }
      const payload = {
        ...form,
        price: form.is_free ? 0 : Number(form.price),
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
      setError("Error de red al guardar");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <a href="/admin/eventos" aria-label="Volver a eventos">
              <ArrowLeft className="size-4" />
            </a>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {event ? form.name_es || "Editar evento" : "Nuevo evento"}
            </h1>
            <p className="text-muted-foreground text-xs">
              {event
                ? `Editando /eventos/${event.slug}`
                : "Crea un evento y configura la venta o reserva de entradas."}
            </p>
          </div>
        </div>

        <Tabs value={lang} onValueChange={(v) => setLang(v as Locale)}>
          <TabsList>
            {LOCALES.map((l) => (
              <TabsTrigger key={l} value={l} className="gap-1 text-xs uppercase">
                <span>{FLAG[l]}</span> {l}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información</CardTitle>
              <CardDescription>Nombre, descripción y enlace del evento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Nombre" htmlFor="e-name">
                <Input
                  id="e-name"
                  value={getL("name")}
                  onChange={(e) => {
                    const val = e.target.value;
                    setL("name", val);
                    if (lang === "es" && !slugManuallyEdited) {
                      set("slug", slugify(val));
                    }
                  }}
                  placeholder="Ej. Festival AFRO IN 2026"
                />
              </Field>

              <Field label="Slug (URL)" htmlFor="e-slug">
                <div className="flex items-center gap-2">
                  <Input
                    id="e-slug"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugManuallyEdited(true);
                      set("slug", slugify(e.target.value));
                    }}
                    placeholder="afro-in-palenque-2026"
                  />
                  {form.name_es && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Sincronizar slug con el nombre"
                      onClick={() => {
                        setSlugManuallyEdited(false);
                        set("slug", slugify(form.name_es));
                      }}
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Ruta pública: /eventos/{form.slug || "..."}
                </p>
              </Field>

              <Field label="Descripción" htmlFor="e-desc">
                <Textarea
                  id="e-desc"
                  rows={4}
                  value={getL("description")}
                  onChange={(e) => setL("description", e.target.value)}
                  placeholder="Describe la experiencia, actividades, artistas y detalles importantes..."
                />
              </Field>
            </CardContent>
          </Card>

          {/* Location Card with Autocomplete */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="size-4 text-primary" />
                Lugar y Ubicación
              </CardTitle>
              <CardDescription>
                Escribe el lugar o dirección para autocompletar ciudad, departamento y país.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Label htmlFor="e-places-search" className="text-xs mb-1 block">
                  Buscar con Google Maps / Autocompletar
                </Label>
                <div className="relative">
                  <Input
                    id="e-places-search"
                    value={geoQuery}
                    onChange={(e) => handleGeoQuery(e.target.value)}
                    placeholder="Escribe el nombre del lugar o dirección (ej. Santa Marta, Rodadero)..."
                    className="pr-9"
                  />
                  <div className="absolute right-2.5 top-2.5 text-muted-foreground pointer-events-none">
                    {searchingGeo ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Search className="size-4" />
                    )}
                  </div>
                </div>

                {geoSuggestions.length > 0 && (
                  <ul className="absolute z-30 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg text-sm divide-y">
                    {geoSuggestions.map((item, idx) => (
                      <li
                        key={idx}
                        onClick={() => selectGeoSuggestion(item)}
                        className="p-2.5 hover:bg-muted cursor-pointer flex flex-col leading-tight"
                      >
                        <span className="font-semibold text-foreground">{item.name}</span>
                        <span className="text-xs text-muted-foreground mt-0.5">
                          {item.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nombre del lugar (Venue)" htmlFor="e-venue">
                  <Input
                    id="e-venue"
                    value={form.venue}
                    onChange={(e) => set("venue", e.target.value)}
                    placeholder="Casa de la Cultura / Playa"
                  />
                </Field>
                <Field label="Ciudad / Municipio" htmlFor="e-city">
                  <Input
                    id="e-city"
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    placeholder="Cartagena"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Departamento / Estado" htmlFor="e-dept">
                  <Input
                    id="e-dept"
                    value={form.department}
                    onChange={(e) => set("department", e.target.value)}
                    placeholder="Bolívar"
                  />
                </Field>
                <Field label="País" htmlFor="e-country">
                  <Input
                    id="e-country"
                    value={form.country}
                    onChange={(e) => set("country", e.target.value)}
                    placeholder="Colombia"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Imagen Portada</CardTitle>
              <CardDescription>webp, jpeg o png (máx. 800 KB).</CardDescription>
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
                    Subir imagen
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
          {/* Date and Time Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-4 text-primary" />
                Fecha y Hora
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="e-date-picker" className="text-xs mb-1 block">
                  Fecha del evento
                </Label>
                <Input
                  id="e-date-picker"
                  type="date"
                  value={datePart}
                  onChange={(e) => updateDateTime(e.target.value, timePart)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="e-time-picker" className="text-xs">
                    Hora de inicio
                  </Label>
                  <span className="text-xs text-muted-foreground font-medium">
                    {timePart ? formatTimeAmPm(timePart) : ""}
                  </span>
                </div>
                <Input
                  id="e-time-picker"
                  type="time"
                  value={timePart}
                  onChange={(e) => updateDateTime(datePart, e.target.value)}
                />

                <div className="flex flex-wrap gap-1 mt-2">
                  {["17:00", "18:00", "19:00", "20:00", "21:00"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => updateDateTime(datePart, t)}
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded border transition-colors",
                        timePart === t
                          ? "bg-primary text-primary-foreground border-primary font-semibold"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground"
                      )}
                    >
                      {formatTimeAmPm(t)}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price, Free Event and Capacity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Precios y Capacidad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                <div className="space-y-0.5 pr-2">
                  <Label htmlFor="e-free" className="text-sm font-semibold cursor-pointer">
                    Evento gratuito
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Entrada libre sin pasarela de cobro.
                  </p>
                </div>
                <Switch
                  id="e-free"
                  checked={form.is_free}
                  onCheckedChange={(checked) => {
                    setForm((f) => ({
                      ...f,
                      is_free: checked,
                      price: checked ? "0" : (f.price === "0" ? "50000" : f.price),
                    }));
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Precio COP" htmlFor="e-price">
                  <Input
                    id="e-price"
                    type="number"
                    disabled={form.is_free}
                    value={form.is_free ? "0" : form.price}
                    onChange={(e) => set("price", e.target.value)}
                    placeholder={form.is_free ? "0" : "50000"}
                    className={cn(form.is_free && "bg-muted/50 opacity-80")}
                  />
                  {form.is_free && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      ✓ Entrada libre / $0
                    </span>
                  )}
                </Field>
                <Field label="Cupo / Capacidad" htmlFor="e-cap">
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
              <CardTitle className="text-base">Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-sm font-medium">
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
