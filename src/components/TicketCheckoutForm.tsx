"use client";

import * as React from "react";
import { Mail, User } from "lucide-react";
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
  /** Short "Quedan 3 a este precio" note shown beside the quantity (few left only). */
  remainingNote?: string;
  /** Single-price events: the price shown beside the quantity ("$50.000 COP"). */
  qtyPrice?: string;
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

// Checkout error codes (api/tickets/checkout) → translation keys.
const ERROR_KEYS: Record<string, string> = {
  not_open: "tix.form.err.notopen",
  sold_out: "tix.form.err.soldout",
  only_left: "tix.form.err.left",
  only_left_stage: "tix.form.err.left.stage",
  seats_taken: "tix.form.err.taken",
  pending_payment: "tix.form.err.pending",
};

export default function TicketCheckoutForm({
  remainingNote,
  qtyPrice,
  lang,
  eventSlug,
  eventName,
  countries,
  price: initialPrice,
  remaining,
  successPath,
  t,
}: Props) {
  const maxQty = Math.max(1, Math.min(MAX_QTY, remaining));
  const [qty, setQty] = React.useState(1);
  // The price shown; the server may answer that it changed (staged prices).
  const [price, setPrice] = React.useState(initialPrice);
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
          // Lets the server refuse if the price moved on; it never sets the charge.
          expectedUnitPrice: price,
          buyer: {
            name: form.name,
            email: form.email,
            phone,
          },
        }),
      });
      const data = (await res.json()) as any;
      if (res.status === 409 && data?.code === "price_changed" && Number.isFinite(data.unitPrice)) {
        // Show the new price; paying again accepts it.
        setPrice(Number(data.unitPrice));
        setError(
          t["tix.form.err.pricechanged"].replace(
            "{price}",
            data.unitPrice === 0 ? t["tix.price.free"] : formatPrice(Number(data.unitPrice))
          )
        );
        setLoading(false);
        return;
      }
      if (!res.ok) {
        // Known refusals have a code with a translated message.
        const key = data?.code ? ERROR_KEYS[data.code] : undefined;
        const msg = key ? t[key]?.replace("{n}", String(data.n ?? "")) : undefined;
        setError(msg || data?.error || t["tix.form.err.generic"]);
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
        {/* Left of the stepper: the price (single-price events) or a short
            caption, plus the few-left note; the full question is for screen readers. */}
        <span className="tix-qty-label">
          <label className="tix-qty-q">{t["tix.form.quantity"]}</label>
          {qtyPrice ? (
            <span className="tix-qty-price">
              <strong>{qtyPrice}</strong>
            </span>
          ) : (
            !remainingNote && <span className="tix-qty-caption" aria-hidden="true">{t["tix.form.qtyShort"]}</span>
          )}
          {remainingNote && <span className="tix-qty-left">{remainingNote}</span>}
        </span>
        <div className="tix-stepper">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label={t["tix.form.qty.less"]}
          >
            −
          </button>
          <span aria-live="polite">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
            disabled={qty >= maxQty}
            aria-label={t["tix.form.qty.more"]}
          >
            +
          </button>
        </div>
      </div>

      <div className={fieldClass("name")}>
        <label htmlFor="tix-name">{t["tix.form.name"]}</label>
        <span className="tix-input-icon">
          <User aria-hidden="true" size={18} />
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
        </span>
        {errorText("name")}
      </div>
      <div className={fieldClass("email")}>
        <label htmlFor="tix-email">{t["tix.form.email"]}</label>
        <span className="tix-input-icon">
          <Mail aria-hidden="true" size={18} />
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
        </span>
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

      {/* No separate total row: the price per ticket is above the form and the
          pay button says the total (Julio). */}

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
            ? t["tix.form.reserve"]
            : t["tix.form.pay"].replace("{total}", formatPrice(total))}
      </button>
      <p className="tix-secure">{t["tix.form.securenote"]}</p>
    </div>
  );
}
