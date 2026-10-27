"use client";

import * as React from "react";
import { formatPrice } from "@/lib/cart";

interface Props {
  lang: "es" | "en" | "fr";
  eventSlug: string;
  eventName: string;
  price: number;
  remaining: number;
  /** Localized success page path, e.g. /entradas. */
  successPath: string;
  t: Record<string, string>;
}

declare global {
  interface Window {
    BoldCheckout: any;
  }
}

const BOLD_SDK = "https://checkout.bold.co/library/boldPaymentButton.js";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_QTY = 10;

let boldSdkPromise: Promise<void> | null = null;
function loadBoldSDK(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.BoldCheckout) return Promise.resolve();
  if (boldSdkPromise) return boldSdkPromise;
  boldSdkPromise = new Promise<void>((resolve) => {
    const s = document.createElement("script");
    s.src = BOLD_SDK;
    s.onload = () => resolve();
    document.body.appendChild(s);
  });
  return boldSdkPromise;
}

export default function TicketCheckoutForm({
  lang,
  eventSlug,
  eventName,
  price,
  remaining,
  successPath,
  t,
}: Props) {
  const maxQty = Math.max(1, Math.min(MAX_QTY, remaining));
  const [qty, setQty] = React.useState(1);
  const [form, setForm] = React.useState({ name: "", email: "", phone: "" });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadBoldSDK();
  }, []);

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const total = price * qty;

  const submit = async () => {
    setError(null);
    if (!form.name.trim()) return setError(t["tix.form.err.name"]);
    if (!EMAIL_RE.test(form.email.trim()))
      return setError(t["tix.form.err.email"]);

    setLoading(true);
    try {
      await loadBoldSDK();
      const res = await fetch("/api/tickets/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug,
          quantity: qty,
          buyer: {
            name: form.name,
            email: form.email,
            phone: form.phone || null,
          },
        }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        setError(data?.error || t["tix.form.err.generic"]);
        setLoading(false);
        return;
      }

      if (data.free) {
        window.location.href = `${successPath}/${data.accessToken}`;
        return;
      }

      sessionStorage.setItem("tix_order_id", data.orderId);

      if (!window.BoldCheckout) {
        setError(t["tix.form.err.generic"]);
        setLoading(false);
        return;
      }

      const boldConfig: Record<string, string> = {
        orderId: data.orderId,
        currency: data.currency,
        amount: data.amount,
        apiKey: data.apiKey,
        integritySignature: data.integritySignature,
        description: `Entradas AFRO IN — ${eventName}`,
      };
      const customerData: Record<string, string> = {
        fullName: form.name.trim(),
        email: form.email.trim(),
      };
      if (form.phone.trim()) customerData.phone = form.phone.trim();
      boldConfig.customerData = JSON.stringify(customerData);

      const origin = window.location.origin;
      if (origin.startsWith("https://"))
        boldConfig.redirectionUrl = origin + successPath;

      const checkout = new window.BoldCheckout(boldConfig);
      checkout.open();
      setLoading(false);
    } catch {
      setError(t["tix.form.err.generic"]);
      setLoading(false);
    }
  };

  if (remaining <= 0) {
    return (
      <div className="tix-soldout">
        <p className="tix-soldout-title">{t["tix.detail.soldout.title"]}</p>
        <p>{t["tix.detail.soldout.text"]}</p>
      </div>
    );
  }

  return (
    <div className="tix-form">
      <div className="tix-qty">
        <label>{t["tix.form.quantity"]}</label>
        <div className="tix-stepper">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label="-"
          >
            −
          </button>
          <span>{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
            disabled={qty >= maxQty}
            aria-label="+"
          >
            +
          </button>
        </div>
      </div>

      <div className="ck-field">
        <label htmlFor="tix-name">{t["tix.form.name"]}</label>
        <input
          id="tix-name"
          type="text"
          autoComplete="name"
          placeholder={t["tix.form.name.ph"]}
          value={form.name}
          onChange={set("name")}
        />
      </div>
      <div className="ck-field">
        <label htmlFor="tix-email">{t["tix.form.email"]}</label>
        <input
          id="tix-email"
          type="email"
          autoComplete="email"
          placeholder={t["tix.form.email.ph"]}
          value={form.email}
          onChange={set("email")}
        />
      </div>
      <div className="ck-field">
        <label htmlFor="tix-phone">{t["tix.form.phone"]}</label>
        <input
          id="tix-phone"
          type="tel"
          autoComplete="tel"
          placeholder={t["tix.form.phone.ph"]}
          value={form.phone}
          onChange={set("phone")}
        />
      </div>

      <div className="tix-total">
        <span>{t["tix.form.total"]}</span>
        <strong>{price === 0 ? "Entrada Libre (Gratis)" : formatPrice(total)}</strong>
      </div>

      {error && <p className="ck-error">{error}</p>}

      <button
        type="button"
        className="btn btn-primary tix-pay"
        onClick={submit}
        disabled={loading}
      >
        {loading
          ? t["tix.form.processing"]
          : price === 0
            ? "Reservar entradas gratis"
            : t["tix.form.pay"]}
      </button>
      <p className="tix-secure">{t["tix.form.securenote"]}</p>
    </div>
  );
}
