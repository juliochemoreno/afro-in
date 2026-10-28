"use client";

import * as React from "react";
import PhoneField from "@/components/checkout/PhoneField";
import type { CountryEntry } from "@/components/CountryCombobox";
import { formatPrice } from "@/lib/cart";
import { buildCustomerData } from "@/lib/boldPrefill";
import { isValidEmail, normalizeStoredPhone } from "@/lib/checkoutFields";

interface Props {
  lang: "es" | "en" | "fr";
  eventSlug: string;
  eventName: string;
  countries: CountryEntry[];
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
const MAX_QTY = 10;

// Fields in screen order: the first invalid one gets the focus.
const FIELDS = ["name", "email", "phone"] as const;
type Field = (typeof FIELDS)[number];
type Errors = Partial<Record<Field, string>>;
const FIELD_IDS: Record<Field, string> = {
  name: "tix-name",
  email: "tix-email",
  phone: "tix-phone",
};

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
  countries,
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
  const [attempted, setAttempted] = React.useState(false);

  React.useEffect(() => {
    loadBoldSDK();
  }, []);

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const total = price * qty;

  const validate = (f: typeof form): Errors => {
    const e: Errors = {};
    if (!f.name.trim()) e.name = t["tix.form.err.name"];
    if (!isValidEmail(f.email)) e.email = t["tix.form.err.email"];
    if (!normalizeStoredPhone(f.phone)) e.phone = t["phone.err"];
    return e;
  };
  // Errors show from the first attempt on and follow the fields as they change.
  const errors: Errors = attempted ? validate(form) : {};

  const submit = async () => {
    setError(null);
    setAttempted(true);
    const found = validate(form);
    const first = FIELDS.find((f) => found[f]);
    if (first) {
      const el = document.getElementById(FIELD_IDS[first]);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }
    const phone = normalizeStoredPhone(form.phone)!;

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
            phone,
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

      try {
        sessionStorage.setItem("tix_order_id", data.orderId);
      } catch {
        /* storage blocked: the receipt still gets the id from Bold's redirect */
      }

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
        customerData: buildCustomerData({
          name: form.name,
          email: form.email,
          phone,
        }),
      };

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

  const fieldClass = (f: Field) => (errors[f] ? "ck-field is-invalid" : "ck-field");
  const errId = (f: Field) => `${FIELD_IDS[f]}-error`;
  const describedBy = (f: Field) => (errors[f] ? errId(f) : undefined);
  const errorText = (f: Field) =>
    errors[f] ? (
      <p className="ck-field-error" id={errId(f)}>
        {errors[f]}
      </p>
    ) : null;

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

      <div className={fieldClass("name")}>
        <label htmlFor="tix-name">{t["tix.form.name"]}</label>
        <input
          id="tix-name"
          type="text"
          autoComplete="name"
          maxLength={100}
          placeholder={t["tix.form.name.ph"]}
          value={form.name}
          onChange={set("name")}
          aria-invalid={!!errors.name || undefined}
          aria-describedby={describedBy("name")}
        />
        {errorText("name")}
      </div>
      <div className={fieldClass("email")}>
        <label htmlFor="tix-email">{t["tix.form.email"]}</label>
        <input
          id="tix-email"
          type="email"
          autoComplete="email"
          maxLength={120}
          placeholder={t["tix.form.email.ph"]}
          value={form.email}
          onChange={set("email")}
          aria-invalid={!!errors.email || undefined}
          aria-describedby={describedBy("email")}
        />
        {errorText("email")}
      </div>
      <div className={fieldClass("phone")}>
        <label htmlFor="tix-phone">{t["tix.form.phone"]}</label>
        <PhoneField
          lang={lang}
          countries={countries}
          geoDefault
          inputId="tix-phone"
          onChange={(phone) => setForm((f) => ({ ...f, phone }))}
          invalid={!!errors.phone}
          ariaDescribedBy={describedBy("phone")}
          placeholder={t["phone.ph"]}
          dialLabel={t["phone.dial.label"]}
          searchPlaceholder={t["phone.dial.search"]}
          emptyText={t["phone.dial.empty"]}
        />
        {errorText("phone")}
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
