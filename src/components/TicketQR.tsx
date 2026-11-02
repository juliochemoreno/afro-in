"use client";

import * as React from "react";
import qrcode from "qrcode-generator";
import { calParts, eventDays } from "@/lib/eventDisplay";

// The QR is drawn at render time with qrcode-generator (bundled, no CDN), so
// it is in the server-rendered HTML and never depends on a third party. Same
// content and settings as the email and the door scanner: the plain code, "M".
function qrDataUrl(code: string): string | null {
  try {
    const qr = qrcode(0, "M");
    qr.addData(code);
    qr.make();
    return qr.createDataURL(6, 6);
  } catch {
    return null;
  }
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
  /** Last day (YYYY-MM-DD) of a multi-day event: the block shows its length. */
  eventEndDate?: string | null;
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
  eventEndDate,
  lang = "es",
  kindLabel,
  indexLabel,
}: Props) {
  const cal = eventDate ? calParts(eventDate, lang) : null;
  // Multi-day event: "3 días" (Julio); the subtitle already gives the dates.
  const days = eventDate ? eventDays(eventDate, lang, eventEndDate) : null;
  const dataUrl = React.useMemo(() => qrDataUrl(code), [code]);

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
              {days ? (
                <>
                  <span className="tix-stub-cal-num">{days.n}</span>
                  <span className="tix-stub-cal-wd">{days.label}</span>
                </>
              ) : (
                <>
                  <span className="tix-stub-cal-wd">{cal.weekday}</span>
                  <span className="tix-stub-cal-num">{cal.day}</span>
                </>
              )}
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
