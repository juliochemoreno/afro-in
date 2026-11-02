"use client";

import * as React from "react";
import TicketList, { type TicketView } from "@/components/TicketList";
import { shortDateRange } from "@/lib/eventDisplay";

interface Props {
  t: Record<string, string>;
  eventsPath: string;
  /** Localized tickets base path, e.g. /entradas — used to build the permalink. */
  ticketsPath: string;
  /** When set (permanent [token] page in pending state), confirm this id
   *  instead of reading it from the URL / sessionStorage. */
  initialOrderId?: string;
  lang?: string;
}

type Phase = "loading" | "success" | "pending" | "failed" | "notfound";

// The contact the failed / not-found states offer (same number as the site's
// floating button, the inbox that answers the ticket emails).
const WHATSAPP_URL = "https://wa.me/41782231433";
const CONTACT_EMAIL = "afroinsantamarta@gmail.com";

function eventSubtitle(event: any, lang: string): string | null {
  if (!event) return null;
  const parts: string[] = [];
  const day = event.event_date ? shortDateRange(event.event_date, lang, event.end_date) : null;
  if (day) parts.push(day);
  const place = [event.venue, event.city].filter(Boolean).join(", ");
  if (place) parts.push(place);
  return parts.join(" · ") || null;
}

export default function TicketReceipt({
  t,
  eventsPath,
  ticketsPath,
  initialOrderId,
  lang,
}: Props) {
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [order, setOrder] = React.useState<any>(null);
  const [event, setEvent] = React.useState<any>(null);
  const [tickets, setTickets] = React.useState<TicketView[]>([]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let storedOrderId: string | null = null;
    try {
      storedOrderId = sessionStorage.getItem("tix_order_id");
    } catch {
      /* storage blocked */
    }
    const orderId =
      initialOrderId ||
      params.get("bold-order-id") ||
      storedOrderId ||
      params.get("bold_order_id") ||
      params.get("orderId");

    if (!orderId) {
      setPhase("notfound");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tickets/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const data = (await res.json()) as any;
        if (cancelled) return;
        setOrder(data.order || null);
        setEvent(data.event || null);
        setTickets((data.tickets as TicketView[]) || []);
        if (data.status === "completed") {
          setPhase("success");
          try {
            sessionStorage.removeItem("tix_order_id");
          } catch {
            /* storage blocked */
          }
        } else if (data.status === "rejected") {
          setPhase("failed");
        } else {
          setPhase("pending");
        }
      } catch {
        if (!cancelled) setPhase("pending");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialOrderId]);

  // The page hero (server-rendered, outside this island) says "Tus entradas"
  // only once there are tickets; "Tu compra" while loading or on an error.
  React.useEffect(() => {
    if (phase === "loading") return;
    const title = document.querySelector(".tix-hero .tx-hero-title");
    const text = phase === "success" ? t["tix.receipt.yourtickets"] : t["tix.receipt.yourorder"];
    if (title && text) title.textContent = text;
  }, [phase, t]);

  if (phase === "loading") {
    return (
      <div className="receipt-status">
        <div className="receipt-spinner" aria-hidden="true" />
        <p>{t["tix.receipt.loading"]}</p>
      </div>
    );
  }

  if (phase === "success" && order) {
    const permalink =
      order.access_token != null
        ? `${window.location.origin}${ticketsPath}/${order.access_token}`
        : null;
    const eventImage = event?.image_r2_key
      ? `/media/${event.image_r2_key}`
      : null;
    return (
      <div className="tix-success">
        {/* The hero already says "Tus entradas": one small line, no second headline. */}
        <p className="tix-confirmed">
          <span aria-hidden="true">✓</span> {t["tix.receipt.confirmed"]}
        </p>
        <TicketList
          eventName={order.event_name}
          eventSubtitle={eventSubtitle(event, lang ?? "es")}
          eventImage={eventImage}
          eventDate={event?.event_date ?? null}
          eventEndDate={event?.end_date ?? null}
          lang={lang}
          orderNumber={order.ref ?? ""}
          tickets={tickets}
          permalink={permalink}
          continueHref={eventsPath}
          continueLabel={t["tix.receipt.continue"]}
          t={t}
        />
      </div>
    );
  }

  const head = {
    pending: { cls: "pending", icon: "…", key: "pending" },
    failed: { cls: "fail", icon: "!", key: "failed" },
    notfound: { cls: "fail", icon: "?", key: "notfound" },
    // "success" without an order (should not happen): the pending screen.
    success: { cls: "pending", icon: "…", key: "pending" },
  }[phase];
  const needsContact = phase !== "pending";

  return (
    <div className="receipt">
      <div className="receipt-head">
        <span className={`receipt-icon ${head.cls}`} aria-hidden="true">
          {head.icon}
        </span>
        <h2>{t[`tix.receipt.${head.key}.title`]}</h2>
      </div>
      <p className="receipt-text">{t[`tix.receipt.${head.key}.text`]}</p>
      {needsContact && (
        <div className="receipt-contact">
          <a href={WHATSAPP_URL} className="btn btn-primary" target="_blank" rel="noopener">
            {t["tix.receipt.contact.whatsapp"]}
          </a>
          <p>
            {t["tix.receipt.contact.email"]} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      )}
      <a href={eventsPath} className="tix-continue">
        {t["tix.receipt.continue"]}
      </a>
    </div>
  );
}
