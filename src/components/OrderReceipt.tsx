"use client";

import * as React from "react";
import { clearCart, formatPrice } from "@/lib/cart";

interface Props {
  t: Record<string, string>;
  storePath: string;
}

type Phase = "loading" | "success" | "pending" | "failed";

interface OrderItem {
  name: string;
  size?: string | null;
  color?: string | null;
  quantity: number;
  line_total: number;
}

export default function OrderReceipt({ t, storePath }: Props) {
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [order, setOrder] = React.useState<any>(null);
  const [items, setItems] = React.useState<OrderItem[]>([]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId =
      params.get("bold-order-id") ||
      sessionStorage.getItem("store_order_id") ||
      params.get("bold_order_id") ||
      params.get("orderId");

    if (!orderId) {
      setPhase("failed");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/store/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const data = (await res.json()) as any;
        if (cancelled) return;
        setOrder(data.order || null);
        setItems((data.items as OrderItem[]) || []);
        if (data.status === "completed") {
          setPhase("success");
          clearCart();
          sessionStorage.removeItem("store_order_id");
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
  }, []);

  if (phase === "loading") {
    return (
      <div className="receipt-status">
        <div className="receipt-spinner" aria-hidden="true" />
        <p>{t["order.loading"]}</p>
      </div>
    );
  }

  const head =
    phase === "success"
      ? { icon: "✓", cls: "ok", title: t["order.success.title"], text: t["order.success.text"] }
      : phase === "pending"
        ? { icon: "⏳", cls: "pending", title: t["order.pending.title"], text: t["order.pending.text"] }
        : { icon: "✕", cls: "fail", title: t["order.failed.title"], text: t["order.failed.text"] };

  return (
    <div className="receipt">
      <div className={`receipt-badge ${head.cls}`} aria-hidden="true">
        {head.icon}
      </div>
      <h1>{head.title}</h1>
      <p className="receipt-text">{head.text}</p>

      {order && (
        <div className="receipt-card">
          <div className="receipt-row">
            <span>{t["order.number"]}</span>
            <strong>#{order.id}</strong>
          </div>
          {items.length > 0 && (
            <ul className="receipt-items">
              {items.map((it, idx) => (
                <li key={idx}>
                  <span>
                    {it.name}
                    {[it.size, it.color].filter(Boolean).length
                      ? ` (${[it.size, it.color].filter(Boolean).join(" · ")})`
                      : ""}
                    {" "}×{it.quantity}
                  </span>
                  <span>{formatPrice(it.line_total)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="receipt-row receipt-total">
            <span>{t["order.total"]}</span>
            <strong>{formatPrice(Number(order.amount))}</strong>
          </div>
        </div>
      )}

      <a href={storePath} className="btn btn-primary">
        {t["order.continue"]}
      </a>
    </div>
  );
}
