"use client";

import * as React from "react";
import TicketList, { type TicketView } from "@/components/TicketList";

interface Props {
  t: Record<string, string>;
  eventsPath: string;
  /** Localized tickets base path, e.g. /entradas — used to build the permalink. */
  ticketsPath: string;
  /** When set (permanent [token] page in pending state), confirm this id
   *  instead of reading it from the URL / sessionStorage. */
  initialOrderId?: string;
}

type Phase = "loading" | "success" | "pending" | "failed";

function eventSubtitle(event: any): string | null {
  if (!event) return null;
  const parts: string[] = [];
  if (event.event_date) {
    const d = new Date(event.event_date);
    if (!isNaN(d.getTime())) {
      parts.push(
        d.toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      );
    }
  }
  const place = [event.venue, event.city].filter(Boolean).join(", ");
  if (place) parts.push(place);
  return parts.join(" · ") || null;
}

export default function TicketReceipt({
  t,
  eventsPath,
  ticketsPath,
  initialOrderId,
}: Props) {
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [order, setOrder] = React.useState<any>(null);
  const [event, setEvent] = React.useState<any>(null);
  const [tickets, setTickets] = React.useState<TicketView[]>([]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId =
      initialOrderId ||
      params.get("bold-order-id") ||
      sessionStorage.getItem("tix_order_id") ||
      params.get("bold_order_id") ||
      params.get("orderId");

    if (!orderId) {
      setPhase("failed");
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
          sessionStorage.removeItem("tix_order_id");
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
        <div className="tix-success-head">
          <div className="receipt-badge ok" aria-hidden="true">
            ✓
          </div>
          <h1>{t["tix.receipt.success.title"]}</h1>
          <p className="receipt-text">{t["tix.receipt.success.text"]}</p>
        </div>
        <TicketList
          eventName={order.event_name}
          eventSubtitle={eventSubtitle(event)}
          eventImage={eventImage}
          orderNumber={order.id}
          tickets={tickets}
          permalink={permalink}
          t={t}
        />
        <a href={eventsPath} className="btn btn-primary tix-continue">
          {t["tix.receipt.continue"]}
        </a>
      </div>
    );
  }

  const head =
    phase === "pending"
      ? {
          cls: "pending",
          icon: "⏳",
          title: t["tix.receipt.pending.title"],
          text: t["tix.receipt.pending.text"],
        }
      : {
          cls: "fail",
          icon: "✕",
          title: t["tix.receipt.failed.title"],
          text: t["tix.receipt.failed.text"],
        };

  return (
    <div className="receipt">
      <div className={`receipt-badge ${head.cls}`} aria-hidden="true">
        {head.icon}
      </div>
      <h1>{head.title}</h1>
      <p className="receipt-text">{head.text}</p>
      <a href={eventsPath} className="btn btn-primary">
        {t["tix.receipt.continue"]}
      </a>
    </div>
  );
}
