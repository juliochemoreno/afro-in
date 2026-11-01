"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import TicketQR from "@/components/TicketQR";

export interface TicketView {
  code: string;
  status: string;
  checked_in_at?: string | null;
}

interface Props {
  eventName: string;
  eventSubtitle?: string | null;
  eventImage?: string | null;
  eventDate?: string | null;
  eventEndDate?: string | null;
  lang?: string;
  orderNumber: number | string;
  tickets: TicketView[];
  /** Permanent link to this order, or null to hide the save-link block. */
  permalink: string | null;
  /** "Back to events" link at the end of the side column. */
  continueHref?: string;
  continueLabel?: string;
  t: Record<string, string>;
}

export default function TicketList({
  eventName,
  eventSubtitle,
  eventImage,
  eventDate,
  eventEndDate,
  lang,
  orderNumber,
  tickets,
  permalink,
  continueHref,
  continueLabel,
  t,
}: Props) {
  const [copied, setCopied] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const isSlider = tickets.length > 1;

  const copy = async () => {
    if (!permalink) return;
    try {
      await navigator.clipboard.writeText(permalink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const onScroll = React.useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.scrollWidth / tickets.length;
    setActive(Math.round(el.scrollLeft / slide));
  }, [tickets.length]);

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.scrollWidth / tickets.length;
    el.scrollTo({ left: slide * i, behavior: "smooth" });
  };

  const stub = (tk: TicketView, i: number) => (
    <TicketQR
      key={tk.code}
      code={tk.code}
      used={tk.status === "checked_in"}
      codeLabel={t["tix.ticket.code"]}
      usedLabel={t["tix.ticket.used"]}
      eventName={eventName}
      eventSubtitle={eventSubtitle}
      eventDate={eventDate}
      eventEndDate={eventEndDate}
      lang={lang}
      kindLabel={t["tix.ticket.kind"]}
      indexLabel={isSlider ? `${i + 1} / ${tickets.length}` : undefined}
    />
  );

  return (
    // Desktop: tickets on the left, order details and actions in a side
    // column; on phones it stacks with the order line first (CSS).
    <div className="tix-list">
      <div className="tix-list-tickets">
        <h2 className="tix-list-title">{t["tix.receipt.yourtickets"]}</h2>
        {isSlider ? (
          <div className="tix-slider">
            <button
              type="button"
              className="tix-slider-arrow prev"
              onClick={() => goTo(Math.max(0, active - 1))}
              disabled={active === 0}
              aria-label={t["tix.receipt.prev"]}
            >
              <ChevronLeft className="size-5" />
            </button>

            <div className="tix-slider-track" ref={trackRef} onScroll={onScroll}>
              {tickets.map((tk, i) => (
                <div className="tix-slide" key={tk.code}>
                  {stub(tk, i)}
                </div>
              ))}
            </div>

            <button
              type="button"
              className="tix-slider-arrow next"
              onClick={() => goTo(Math.min(tickets.length - 1, active + 1))}
              disabled={active === tickets.length - 1}
              aria-label={t["tix.receipt.next"]}
            >
              <ChevronRight className="size-5" />
            </button>

            <div className="tix-dots">
              {tickets.map((tk, i) => (
                <button
                  key={tk.code}
                  type="button"
                  className={`tix-dot ${i === active ? "on" : ""}`}
                  onClick={() => goTo(i)}
                  aria-label={t["tix.receipt.ticketn"].replace("{n}", String(i + 1))}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="tix-single">{tickets.map((tk, i) => stub(tk, i))}</div>
        )}
      </div>

      <aside className="tix-list-side">
        <div className="tix-list-head">
          <div className="tix-list-row">
            <span>{t["tix.receipt.event"]}</span>
            <strong>{eventName}</strong>
          </div>
          <div className="tix-list-row">
            <span>{t["tix.receipt.number"]}</span>
            <strong>#{orderNumber}</strong>
          </div>
        </div>

        <button type="button" className="tix-print" onClick={() => window.print()}>
          {t["tix.receipt.print"]}
        </button>

        {permalink && (
          <div className="tix-savelink">
            <p className="tix-savelink-title">{t["tix.receipt.savelink.title"]}</p>
            <p className="tix-savelink-text">{t["tix.receipt.savelink.text"]}</p>
            <div className="tix-savelink-row">
              <input readOnly value={permalink} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn btn-primary" onClick={copy}>
                {copied ? t["tix.receipt.copied"] : t["tix.receipt.copy"]}
              </button>
            </div>
          </div>
        )}

        {continueHref && (
          <a href={continueHref} className="btn btn-primary tix-continue">
            {continueLabel}
          </a>
        )}
      </aside>
    </div>
  );
}
