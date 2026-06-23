"use client";

import * as React from "react";
import CountryCombobox from "@/components/CountryCombobox";
import { getCart, formatPrice, type Cart } from "@/lib/cart";

interface CountryEntry {
  code: string;
  emoji: string;
  name: string;
}

interface Props {
  lang: "es" | "en" | "fr";
  countries: CountryEntry[];
  /** Localized success page path, e.g. /pedido. */
  successPath: string;
  /** Localized store path for the empty-cart CTA. */
  storePath: string;
  /** Localized search/empty labels for the country combobox. */
  countryStrings: { placeholder: string; search: string; empty: string };
  t: Record<string, string>;
}

declare global {
  interface Window {
    BoldCheckout: any;
  }
}

const BOLD_SDK = "https://checkout.bold.co/library/boldPaymentButton.js";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export default function CheckoutForm({
  lang,
  countries,
  successPath,
  storePath,
  countryStrings,
  t,
}: Props) {
  const [cart, setCart] = React.useState<Cart>({
    items: [],
    totalItems: 0,
    totalPrice: 0,
  });
  const [ready, setReady] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    city: "",
    address: "",
    notes: "",
  });

  React.useEffect(() => {
    setCart(getCart());
    setReady(true);
    loadBoldSDK();
  }, []);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setError(null);
    if (!form.name.trim()) return setError(t["checkout.err.name"]);
    if (!EMAIL_RE.test(form.email.trim()))
      return setError(t["checkout.err.email"]);
    if (!form.city.trim()) return setError(t["checkout.err.city"]);
    if (!form.address.trim()) return setError(t["checkout.err.address"]);
    if (cart.items.length === 0) return;

    const code =
      (document.getElementById("checkout-country") as HTMLInputElement | null)
        ?.value || "";
    const country = countries.find((c) => c.code === code)?.name || code;

    const items = cart.items.map((i) => ({
      slug: i.slug || i.id,
      sku: i.sku,
      size: i.size,
      color: i.color,
      quantity: i.quantity,
    }));

    setLoading(true);
    try {
      await loadBoldSDK();
      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          customer: {
            name: form.name,
            email: form.email,
            phone: form.phone || null,
          },
          shipping: {
            country,
            department: form.department,
            city: form.city,
            address: form.address,
            notes: form.notes,
          },
        }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        setError(data?.error || t["checkout.err.generic"]);
        setLoading(false);
        return;
      }

      sessionStorage.setItem("store_order_id", data.orderId);

      if (!window.BoldCheckout) {
        setError(t["checkout.err.generic"]);
        setLoading(false);
        return;
      }

      const boldConfig: Record<string, string> = {
        orderId: data.orderId,
        currency: data.currency,
        amount: data.amount,
        apiKey: data.apiKey,
        integritySignature: data.integritySignature,
        description: "Pedido tienda AFRO IN",
      };
      const customerData: Record<string, string> = {
        fullName: form.name.trim(),
        email: form.email.trim(),
      };
      if (form.phone.trim()) customerData.phone = form.phone.trim();
      boldConfig.customerData = JSON.stringify(customerData);

      // Bold only accepts a public HTTPS redirect URL.
      const origin = window.location.origin;
      if (origin.startsWith("https://"))
        boldConfig.redirectionUrl = origin + successPath;

      const checkout = new window.BoldCheckout(boldConfig);
      checkout.open();
      setLoading(false);
    } catch {
      setError(t["checkout.err.generic"]);
      setLoading(false);
    }
  };

  if (!ready) {
    return <div className="checkout-loading">…</div>;
  }

  if (cart.items.length === 0) {
    return (
      <div className="checkout-empty">
        <p>{t["checkout.empty.title"]}</p>
        <a href={storePath} className="btn btn-primary">
          {t["checkout.empty.cta"]}
        </a>
      </div>
    );
  }

  return (
    <div className="checkout-grid">
      <div className="checkout-main">
        <fieldset className="checkout-card">
          <legend>{t["checkout.contact.title"]}</legend>
          <div className="ck-field">
            <label htmlFor="ck-name">{t["checkout.name"]}</label>
            <input
              id="ck-name"
              type="text"
              autoComplete="name"
              placeholder={t["checkout.name.ph"]}
              value={form.name}
              onChange={set("name")}
            />
          </div>
          <div className="ck-row">
            <div className="ck-field">
              <label htmlFor="ck-email">{t["checkout.email"]}</label>
              <input
                id="ck-email"
                type="email"
                autoComplete="email"
                placeholder={t["checkout.email.ph"]}
                value={form.email}
                onChange={set("email")}
              />
            </div>
            <div className="ck-field">
              <label htmlFor="ck-phone">{t["checkout.phone"]}</label>
              <input
                id="ck-phone"
                type="tel"
                autoComplete="tel"
                placeholder={t["checkout.phone.ph"]}
                value={form.phone}
                onChange={set("phone")}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="checkout-card">
          <legend>{t["checkout.shipping.title"]}</legend>
          <div className="ck-field">
            <label>{t["checkout.country"]}</label>
            <CountryCombobox
              lang={lang}
              countries={countries}
              inputId="checkout-country"
              name="checkout-country"
              placeholder={countryStrings.placeholder}
              searchPlaceholder={countryStrings.search}
              emptyText={countryStrings.empty}
            />
          </div>
          <div className="ck-row">
            <div className="ck-field">
              <label htmlFor="ck-department">{t["checkout.department"]}</label>
              <input
                id="ck-department"
                type="text"
                placeholder={t["checkout.department.ph"]}
                value={form.department}
                onChange={set("department")}
              />
            </div>
            <div className="ck-field">
              <label htmlFor="ck-city">{t["checkout.city"]}</label>
              <input
                id="ck-city"
                type="text"
                autoComplete="address-level2"
                placeholder={t["checkout.city.ph"]}
                value={form.city}
                onChange={set("city")}
              />
            </div>
          </div>
          <div className="ck-field">
            <label htmlFor="ck-address">{t["checkout.address"]}</label>
            <input
              id="ck-address"
              type="text"
              autoComplete="street-address"
              placeholder={t["checkout.address.ph"]}
              value={form.address}
              onChange={set("address")}
            />
          </div>
          <div className="ck-field">
            <label htmlFor="ck-notes">{t["checkout.notes"]}</label>
            <textarea
              id="ck-notes"
              rows={2}
              placeholder={t["checkout.notes.ph"]}
              value={form.notes}
              onChange={set("notes")}
            />
          </div>
        </fieldset>
      </div>

      <aside className="checkout-summary">
        <h3>{t["checkout.summary.title"]}</h3>
        <ul className="ck-items">
          {cart.items.map((i) => (
            <li key={i.id} className="ck-item">
              {i.image ? (
                <img className="ck-item-img" src={i.image} alt="" />
              ) : (
                <span className="ck-item-img ck-item-noimg" />
              )}
              <div className="ck-item-info">
                <span className="ck-item-name">{i.name}</span>
                <span className="ck-item-meta">
                  {[i.size, i.color].filter(Boolean).join(" · ")}
                  {i.size || i.color ? " · " : ""}×{i.quantity}
                </span>
              </div>
              <span className="ck-item-price">
                {formatPrice(i.price * i.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="ck-total">
          <span>{t["checkout.total"]}</span>
          <strong>{formatPrice(cart.totalPrice)}</strong>
        </div>

        {error && <p className="ck-error">{error}</p>}

        <button
          type="button"
          className="btn btn-primary ck-pay"
          onClick={submit}
          disabled={loading}
        >
          {loading ? t["checkout.processing"] : t["checkout.pay"]}
        </button>
        <p className="ck-secure">{t["checkout.securenote"]}</p>
      </aside>
    </div>
  );
}
