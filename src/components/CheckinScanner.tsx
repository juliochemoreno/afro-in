"use client";

import * as React from "react";
import { Camera, CameraOff, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

// Mirrors CheckInResult (lib/tickets.ts); day/days/today come from a
// multi-day pass, checked in once per door day.
type Verdict =
  | { result: "ok"; attendee: string; eventName: string; day?: number; days?: number }
  | {
      result: "already";
      attendee: string;
      eventName: string;
      checkedInAt: string;
      today?: boolean;
    }
  | {
      result: "out_of_range";
      attendee: string;
      eventName: string;
      startDate: string;
      endDate: string;
    }
  | { result: "not_found" }
  | { result: "not_paid" }
  | { result: "error" };

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}

// Resolve a QR detector: native BarcodeDetector when it supports qr_code,
// otherwise the barcode-detector ponyfill loaded from a CDN (Safari/iOS).
async function getDetector(): Promise<BarcodeDetectorLike | null> {
  try {
    const AnyBD = (window as any).BarcodeDetector;
    if (AnyBD) {
      const formats: string[] = (await AnyBD.getSupportedFormats?.()) || [];
      if (!formats.length || formats.includes("qr_code")) {
        return new AnyBD({ formats: ["qr_code"] });
      }
    }
  } catch {
    /* fall through to ponyfill */
  }
  try {
    // Exact version (it pins zxing-wasm 1.3.4 itself): this code runs on an
    // admin page, so it must not follow a floating range.
    const ponyfillUrl = "https://esm.sh/barcode-detector@2.3.1/pure";
    const mod: any = await import(/* @vite-ignore */ ponyfillUrl);
    const BD = mod.BarcodeDetector || mod.default?.BarcodeDetector;
    if (BD) return new BD({ formats: ["qr_code"] });
  } catch {
    /* no detector available */
  }
  return null;
}

const DEBOUNCE_MS = 3000;

export default function CheckinScanner() {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const detectorRef = React.useRef<BarcodeDetectorLike | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const lastCodeRef = React.useRef<{ code: string; at: number }>({
    code: "",
    at: 0,
  });
  const busyRef = React.useRef(false);

  const [scanning, setScanning] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [verdict, setVerdict] = React.useState<Verdict | null>(null);
  const [manual, setManual] = React.useState("");
  const [count, setCount] = React.useState(0);

  const submitCode = React.useCallback(async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    busyRef.current = true;
    try {
      const res = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        setVerdict({ result: "error" });
        return;
      }
      const data = (await res.json()) as Verdict;
      setVerdict(data);
      if (data.result === "ok") setCount((c) => c + 1);
    } catch {
      setVerdict({ result: "error" });
    } finally {
      busyRef.current = false;
    }
  }, []);

  const tick = React.useCallback(async () => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (video && detector && video.readyState >= 2 && !busyRef.current) {
      try {
        const codes = await detector.detect(video);
        if (codes.length > 0) {
          const value = codes[0].rawValue;
          const now = Date.now();
          const last = lastCodeRef.current;
          if (!(value === last.code && now - last.at < DEBOUNCE_MS)) {
            lastCodeRef.current = { code: value, at: now };
            await submitCode(value);
          }
        }
      } catch {
        /* ignore a single failed frame */
      }
    }
    rafRef.current = requestAnimationFrame(() => {
      // throttle to ~5 fps
      setTimeout(tick, 200);
    });
  }, [submitCode]);

  const stop = React.useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const start = React.useCallback(async () => {
    setCameraError(null);
    setVerdict(null);
    const detector = await getDetector();
    if (!detector) {
      setCameraError(
        "Este navegador no puede escanear QR. Usa la entrada manual."
      );
      return;
    }
    detectorRef.current = detector;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      setTimeout(tick, 200);
    } catch {
      setCameraError(
        "No se pudo acceder a la cámara. Revisa permisos o usa la entrada manual."
      );
    }
  }, [tick]);

  React.useEffect(() => {
    return () => stop();
  }, [stop]);

  const card = verdict ? verdictCard(verdict) : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <div className="text-center">
        <h1 className="text-foreground text-2xl font-extrabold">Check-in</h1>
        <p className="text-muted-foreground text-sm">
          Válidas en esta sesión: <strong>{count}</strong>
        </p>
      </div>

      <div className="bg-secondary relative aspect-square w-full overflow-hidden rounded-xl">
        <video
          ref={videoRef}
          playsInline
          muted
          className="size-full object-cover"
        />
        {!scanning && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white/70 text-sm">Cámara apagada</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/60" />
      </div>

      {cameraError && (
        <p className="text-destructive text-center text-sm">{cameraError}</p>
      )}

      <div className="flex justify-center gap-3">
        {!scanning ? (
          <button
            type="button"
            onClick={start}
            className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-semibold"
          >
            <Camera className="size-5" /> Iniciar cámara
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="border-border text-foreground inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 font-semibold"
          >
            <CameraOff className="size-5" /> Detener
          </button>
        )}
      </div>

      {card && (
        <div className={`rounded-xl border p-4 text-center ${card.cls}`}>
          <div className="mb-1 flex justify-center">{card.icon}</div>
          <p className="text-lg font-bold">{card.title}</p>
          {card.subtitle && <p className="text-sm">{card.subtitle}</p>}
          <button
            type="button"
            onClick={() => setVerdict(null)}
            className="mt-3 rounded-lg bg-white/20 px-4 py-1.5 text-sm font-semibold"
          >
            Escanear siguiente
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) {
            submitCode(manual);
            setManual("");
          }
        }}
        className="flex gap-2"
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Código manual"
          className="border-border bg-background text-foreground min-w-0 flex-1 rounded-lg border px-3 py-2 font-mono tracking-wider uppercase"
        />
        <button
          type="submit"
          className="bg-secondary text-secondary-foreground rounded-lg px-4 py-2 font-semibold"
        >
          Validar
        </button>
      </form>
    </div>
  );
}

function verdictCard(v: Verdict): {
  cls: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
} {
  switch (v.result) {
    case "ok":
      return {
        cls: "border-emerald-300 bg-emerald-500 text-white",
        icon: <CheckCircle2 className="size-8" />,
        title: v.attendee,
        subtitle: v.days ? `Válida · día ${v.day} de ${v.days}` : v.eventName,
      };
    case "already":
      if (v.today) {
        return {
          cls: "border-amber-300 bg-amber-500 text-white",
          icon: <AlertTriangle className="size-8" />,
          title: "Ya entró hoy",
          subtitle: `${v.attendee} · a las ${formatTime(v.checkedInAt)}`,
        };
      }
      return {
        cls: "border-amber-300 bg-amber-500 text-white",
        icon: <AlertTriangle className="size-8" />,
        title: "Ya usada",
        subtitle: `${v.attendee} · ${formatTime(v.checkedInAt)}`,
      };
    case "out_of_range":
      return {
        cls: "border-red-300 bg-red-500 text-white",
        icon: <XCircle className="size-8" />,
        title: "Fuera de fechas",
        subtitle: `${v.attendee} · ${formatDay(v.startDate)} a ${formatDay(v.endDate)}`,
      };
    case "not_paid":
      return {
        cls: "border-red-300 bg-red-500 text-white",
        icon: <XCircle className="size-8" />,
        title: "Pago no confirmado",
      };
    case "error":
      return {
        cls: "border-red-300 bg-red-500 text-white",
        icon: <XCircle className="size-8" />,
        title: "Error de red",
        subtitle: "Reintenta",
      };
    default:
      return {
        cls: "border-red-300 bg-red-500 text-white",
        icon: <XCircle className="size-8" />,
        title: "No encontrada",
      };
  }
}

function formatTime(ts: string): string {
  if (!ts) return "";
  const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Bogota",
  });
}

// "2027-01-15" -> "15 ene" (a calendar date, so read and shown in UTC).
function formatDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
}
