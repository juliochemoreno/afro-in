"use client";

import * as React from "react";
import { calParts } from "@/lib/eventDisplay";

// Load a tiny QR generator from CDN at runtime (same pattern as the Bold SDK) so
// we don't add an npm dependency. The ticket code is encoded entirely in the
// browser — it never leaves the page — so no secret reaches the CDN.
const QR_SDK =
  "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";
// Subresource Integrity: the browser refuses the script if the CDN serves
// anything other than this exact file.
const QR_SDK_INTEGRITY =
  "sha384-8FWZA6BGMXhsfO+BLtrJK0We6gg5o1JyO8xQm6peWDEUs17ACA5ziE/NIAkl9z2k";

declare global {
  interface Window {
    // qrcode-generator UMD global (loaded from CDN at runtime)
    qrcode?: (
      typeNumber: number,
      errorCorrectionLevel: "L" | "M" | "Q" | "H"
    ) => {
      addData: (data: string) => void;
      make: () => void;
      createDataURL: (cellSize?: number, margin?: number) => string;
    };
  }
}

let qrSdkPromise: Promise<void> | null = null;
function loadQrSDK(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.qrcode) return Promise.resolve();
  if (qrSdkPromise) return qrSdkPromise;
  qrSdkPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = QR_SDK;
    s.integrity = QR_SDK_INTEGRITY;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("qr sdk failed"));
    document.body.appendChild(s);
  });
  return qrSdkPromise;
}

interface Props {
  code: string;
  used?: boolean;
  codeLabel: string;
  usedLabel: string;
  eventName: string;
  eventSubtitle?: string | null;
  /** Event date (YYYY-MM-DDTHH:MM, Bogotá) for the calendar block. */
  eventDate?: string | null;
  lang?: string;
  /** "Entrada" / "Ticket" / "Billet". */
  kindLabel: string;
  indexLabel?: string;
}

export default function TicketQR({
  code,
  used,
  codeLabel,
  usedLabel,
  eventName,
  eventSubtitle,
  eventDate,
  lang = "es",
  kindLabel,
  indexLabel,
}: Props) {
  const cal = eventDate ? calParts(eventDate, lang) : null;
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    loadQrSDK()
      .then(() => {
        if (cancelled || !window.qrcode) return;
        const qr = window.qrcode(0, "M");
        qr.addData(code);
        qr.make();
        if (!cancelled) setDataUrl(qr.createDataURL(6, 6));
      })
      .catch(() => {
        /* fall back to code text only */
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <article className={`tix-stub ${used ? "used" : ""}`}>
      <header className="tix-stub-banner">
        <div className="tix-stub-top">
          <span className="tix-stub-brand">AFRO IN</span>
          <span className="tix-stub-kind">
            {kindLabel}
            {indexLabel && ` ${indexLabel}`}
          </span>
        </div>
        <span className="tix-stub-name">{eventName}</span>
        <div className="tix-stub-meta">
          {cal && cal.day && (
            <span className="tix-stub-cal" aria-hidden="true">
              <span className="tix-stub-cal-wd">{cal.weekday}</span>
              <span className="tix-stub-cal-num">{cal.day}</span>
            </span>
          )}
          {eventSubtitle && <span className="tix-stub-sub">{eventSubtitle}</span>}
        </div>
      </header>

      <div className="tix-stub-perf" aria-hidden="true" />

      <div className="tix-stub-body">
        <div className="tix-stub-qr">
          {/* Pure white box: the QR keeps its contrast and quiet zone in any theme. */}
          <div className="tix-stub-qr-box">
            {dataUrl ? (
              <img src={dataUrl} alt={code} width={200} height={200} />
            ) : (
              <div className="tix-stub-qr-ph" />
            )}
          </div>
          {used && <span className="tix-stub-used">{usedLabel}</span>}
        </div>

        <div className="tix-stub-code">
          <span className="tix-stub-code-label">{codeLabel}</span>
          <span className="tix-stub-code-value">{code}</span>
        </div>

      </div>
    </article>
  );
}
