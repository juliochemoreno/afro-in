"use client";

import * as React from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Keyboard,
  LogOut,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from "lucide-react";
import { doorVerdict, type DoorTone, type Verdict } from "@/lib/doorVerdict";

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

// The same code is ignored this long after its result closes, so a QR still
// in front of the camera does not come back as "Ya entró hoy".
const DEBOUNCE_MS = 3000;
// A result covers the screen this long, then the camera is back (Julio).
const RESULT_MS = 2500;
const MUTE_KEY = "door-muted";

const TONE_BG: Record<DoorTone, string> = {
  ok: "#1f8a4c",
  warn: "#e6b84a",
  bad: "#d0342c",
};

// Beeps (Hz, seconds) and vibration (ms) per result.
const BEEPS: Record<DoorTone, [number, number][]> = {
  ok: [[880, 0.12]],
  warn: [
    [660, 0.1],
    [660, 0.1],
  ],
  bad: [[220, 0.35]],
};
const VIBRATION: Record<DoorTone, number[]> = {
  ok: [80],
  warn: [80, 60, 80],
  bad: [300],
};

export default function CheckinScanner({ exitHref }: { exitHref: string | null }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const detectorRef = React.useRef<BarcodeDetectorLike | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const audioRef = React.useRef<AudioContext | null>(null);
  const lastCodeRef = React.useRef<{ code: string; at: number }>({
    code: "",
    at: 0,
  });
  const busyRef = React.useRef(false);
  const verdictRef = React.useRef<Verdict | null>(null);
  const mutedRef = React.useRef(false);

  const [scanning, setScanning] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [verdict, setVerdict] = React.useState<Verdict | null>(null);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [manual, setManual] = React.useState("");
  const [count, setCount] = React.useState(0);
  const [muted, setMuted] = React.useState(false);

  React.useEffect(() => {
    try {
      const m = localStorage.getItem(MUTE_KEY) === "1";
      mutedRef.current = m;
      setMuted(m);
    } catch {
      /* storage blocked: sound on */
    }
  }, []);

  const toggleMute = () => {
    const m = !mutedRef.current;
    mutedRef.current = m;
    setMuted(m);
    try {
      localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {
      /* not remembered */
    }
  };

  // Phones only allow sound after a tap: create/resume the context inside
  // the "Iniciar cámara" and "Validar" handlers.
  const unlockAudio = () => {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      if (!audioRef.current) audioRef.current = new AC();
      void audioRef.current.resume();
    } catch {
      /* no sound */
    }
  };

  const feedback = (tone: DoorTone) => {
    try {
      navigator.vibrate?.(VIBRATION[tone]);
    } catch {
      /* no vibration (iPhone) */
    }
    const ctx = audioRef.current;
    if (mutedRef.current || !ctx) return;
    let t = ctx.currentTime;
    for (const [freq, dur] of BEEPS[tone]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur + 0.08;
    }
  };

  const show = (v: Verdict) => {
    verdictRef.current = v;
    setVerdict(v);
    feedback(doorVerdict(v).tone);
    if (v.result === "ok") setCount((c) => c + 1);
  };

  const dismiss = React.useCallback(() => {
    verdictRef.current = null;
    setVerdict(null);
    // Restart the debounce now, so the code still in front is not re-sent.
    lastCodeRef.current = { ...lastCodeRef.current, at: Date.now() };
  }, []);

  // Results close by themselves; "Sesión vencida" waits for the login link.
  React.useEffect(() => {
    if (!verdict || verdict.result === "expired") return;
    const t = setTimeout(dismiss, RESULT_MS);
    return () => clearTimeout(t);
  }, [verdict, dismiss]);

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
      if (res.status === 401) return show({ result: "expired" });
      if (!res.ok) return show({ result: "error" });
      show((await res.json()) as Verdict);
    } catch {
      show({ result: "error" });
    } finally {
      busyRef.current = false;
    }
    // show/feedback only read refs, so the callback can stay stable.
  }, []);

  const tick = React.useCallback(async () => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (
      video &&
      detector &&
      video.readyState >= 2 &&
      !busyRef.current &&
      !verdictRef.current
    ) {
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
    unlockAudio();
    setCameraError(null);
    const detector = await getDetector();
    if (!detector) {
      setCameraError("Este navegador no puede escanear QR. Usa el código manual.");
      setManualOpen(true);
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
      setCameraError("No se pudo abrir la cámara. Revisa el permiso o usa el código manual.");
      setManualOpen(true);
    }
  }, [tick]);

  React.useEffect(() => {
    return () => stop();
  }, [stop]);

  const view = verdict ? doorVerdict(verdict) : null;
  const barButton =
    "flex size-11 items-center justify-center text-[#f3e9d2]/80 active:bg-white/10";

  return (
    <div
      className="fixed inset-0 flex flex-col bg-[#161616] text-[#f3e9d2]"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Door bar */}
      <header className="flex h-14 shrink-0 items-center gap-1 px-2">
        <span className="door-display px-2 text-2xl uppercase">Puerta</span>
        <span
          className="bg-[#1f8a4c] px-2 py-0.5 text-sm font-bold text-white tabular-nums"
          aria-label={`${count} válidas en esta sesión`}
        >
          {count}
        </span>
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={toggleMute}
            className={barButton}
            aria-label={muted ? "Activar sonido" : "Silenciar"}
          >
            {muted ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}
          </button>
          <button
            type="button"
            onClick={() => setManualOpen((o) => !o)}
            className={barButton}
            aria-label="Código manual"
            aria-expanded={manualOpen}
          >
            <Keyboard className="size-6" />
          </button>
          <a href="/api/admin-logout" className={barButton} aria-label="Salir">
            <LogOut className="size-6" />
          </a>
          {exitHref && (
            <a href={exitHref} className={barButton} aria-label="Volver al panel">
              <X className="size-6" />
            </a>
          )}
        </div>
      </header>

      {/* Camera */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 size-full object-cover"
        />
        {scanning ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative size-[min(70vw,60vh)]">
              <span className="absolute top-0 left-0 size-10 border-t-4 border-l-4 border-[#f3e9d2]" />
              <span className="absolute top-0 right-0 size-10 border-t-4 border-r-4 border-[#f3e9d2]" />
              <span className="absolute bottom-0 left-0 size-10 border-b-4 border-l-4 border-[#f3e9d2]" />
              <span className="absolute right-0 bottom-0 size-10 border-r-4 border-b-4 border-[#f3e9d2]" />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <button
              type="button"
              onClick={start}
              className="door-display flex items-center gap-3 bg-[#f3e9d2] px-8 py-5 text-2xl text-[#161616] uppercase active:opacity-80"
            >
              <Camera className="size-7" /> Iniciar cámara
            </button>
            {cameraError && <p className="max-w-xs text-sm text-[#f3e9d2]/80">{cameraError}</p>}
          </div>
        )}
      </div>

      {/* Manual code */}
      {manualOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!manual.trim()) return;
            unlockAudio();
            submitCode(manual);
            setManual("");
          }}
          className="flex shrink-0 gap-2 border-t border-[#f3e9d2]/15 p-3"
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Código"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Código de la entrada"
            className="min-w-0 flex-1 border border-[#f3e9d2]/30 bg-white/5 px-3 py-3 font-mono text-lg tracking-widest text-[#f3e9d2] uppercase placeholder:text-[#f3e9d2]/40 focus:border-[#f3e9d2] focus:outline-none"
          />
          <button
            type="submit"
            className="bg-[#d0342c] px-5 py-3 text-lg font-bold text-white active:opacity-80"
          >
            Validar
          </button>
        </form>
      )}

      {/* Result, full screen; a tap closes it sooner */}
      {view && verdict && (
        <div
          role="status"
          aria-live="assertive"
          onClick={verdict.result === "expired" ? undefined : dismiss}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 p-8 text-center"
          style={{
            background: TONE_BG[view.tone],
            color: view.tone === "warn" ? "#161616" : "#fff",
          }}
        >
          {view.tone === "ok" && <CheckCircle2 className="size-24" strokeWidth={2.5} />}
          {view.tone === "warn" && <AlertTriangle className="size-24" strokeWidth={2.5} />}
          {view.tone === "bad" && <XCircle className="size-24" strokeWidth={2.5} />}
          <p className="door-display text-5xl leading-none break-words uppercase sm:text-7xl">
            {view.title}
          </p>
          {view.detail && <p className="text-xl font-semibold sm:text-2xl">{view.detail}</p>}
          {verdict.result === "expired" && (
            <a
              href="/admin/login?next=/admin/checkin"
              className="mt-2 bg-white px-6 py-3 text-lg font-bold text-[#161616]"
            >
              Ingresar
            </a>
          )}
        </div>
      )}
    </div>
  );
}
