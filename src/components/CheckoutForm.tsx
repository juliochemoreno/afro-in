"use client";

import * as React from "react";
import PhoneField from "@/components/checkout/PhoneField";
import LocationFields, {
  type LocationValue,
  type RegionMode,
} from "@/components/checkout/LocationFields";
import {
  fetchGeoCountry,
  type CountryEntry,
} from "@/components/CountryCombobox";
import { getCart, formatPrice, type Cart } from "@/lib/cart";
import { buildBillingAddress, buildCustomerData } from "@/lib/boldPrefill";
import { isValidEmail, normalizeStoredPhone } from "@/lib/checkoutFields";

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

// Fields in screen order: the first invalid one gets the focus.
const FIELDS = [
  "name",
  "email",
  "phone",
  "country",
  "department",
  "city",
  "address",
] as const;
type Field = (typeof FIELDS)[number];
type Errors = Partial<Record<Field, string>>;

const FIELD_IDS: Record<Field, string> = {
  name: "ck-name",
  email: "ck-email",
  phone: "ck-phone",
  country: "ck-country",
  department: "ck-department",
  city: "ck-city",
  address: "ck-address",
};

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
    address: "",
    notes: "",
  });
  const [location, setLocation] = React.useState<LocationValue>({
    country: "CO",
    department: "",
    city: "",
  });
  const [regionMode, setRegionMode] = React.useState<RegionMode | null>(null);
  const [attempted, setAttempted] = React.useState(false);
  const countryTouched = React.useRef(false);

  React.useEffect(() => {
    setCart(getCart());
    setReady(true);
    loadBoldSDK();
    // Preselect the visitor's country unless they already picked one.
    fetchGeoCountry().then((code) => {
      if (countryTouched.current || !code || code === "CO") return;
      if (countries.some((c) => c.code === code))
        setLocation({ country: code, department: "", city: "" });
    });
  }, [countries]);

  const validate = (
    f: typeof form,
    loc: LocationValue,
    mode: RegionMode | null,
  ): Errors => {
    const e: Errors = {};
    if (!f.name.trim()) e.name = t["checkout.err.name"];
    if (!isValidEmail(f.email)) e.email = t["checkout.err.email"];
    if (!normalizeStoredPhone(f.phone)) e.phone = t["phone.err"];
    if (!loc.country) e.country = t["checkout.err.country"];
    if (mode !== "text" && !loc.department.trim())
      e.department = t["checkout.err.department"];
    if (!loc.city.trim()) e.city = t["checkout.err.city"];
    if (!f.address.trim()) e.address = t["checkout.err.address"];
    return e;
  };

  // Errors show from the first Pay attempt on and follow the fields as they change.
  const errors: Errors = attempted ? validate(form, location, regionMode) : {};

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const focusField = (field: Field) => {
    const el = document.getElementById(FIELD_IDS[field]);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  };

  const submit = async () => {
    setError(null);
    setAttempted(true);
    const found = validate(form, location, regionMode);
    const first = FIELDS.find((f) => found[f]);
    if (first) return focusField(first);
    if (cart.items.length === 0) return;

    const phone = normalizeStoredPhone(form.phone)!;
    const countryName =
      countries.find((c) => c.code === location.country)?.name ||
      location.country;

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
            phone,
          },
          shipping: {
            country: countryName,
            countryCode: location.country,
            department: location.department,
            city: location.city,
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
        customerData: buildCustomerData({
          name: form.name,
          email: form.email,
          phone,
        }),
      };
      const billingAddress = buildBillingAddress({
        address: form.address,
        city: location.city,
        state: location.department,
        country: location.country,
      });
      if (billingAddress) boldConfig.billingAddress = billingAddress;

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

  const fieldClass = (f: Field) =>
    errors[f] ? "ck-field is-invalid" : "ck-field";
  const errId = (f: Field) => `${FIELD_IDS[f]}-error`;
  const describedBy = (f: Field) => (errors[f] ? errId(f) : undefined);
  const errorText = (f: Field) =>
    errors[f] ? (
      <p className="ck-field-error" id={errId(f)}>
        {errors[f]}
      </p>
    ) : null;

  return (
    <div className="checkout-grid">
      <div className="checkout-main">
        <fieldset className="checkout-card">
          <legend>{t["checkout.contact.title"]}</legend>
          <div className={fieldClass("name")}>
            <label htmlFor="ck-name">{t["checkout.name"]}</label>
            <input
              id="ck-name"
              type="text"
              autoComplete="name"
              maxLength={100}
              placeholder={t["checkout.name.ph"]}
              value={form.name}
              onChange={set("name")}
              aria-invalid={!!errors.name || undefined}
              aria-describedby={describedBy("name")}
            />
            {errorText("name")}
          </div>
          <div className={fieldClass("email")}>
            <label htmlFor="ck-email">{t["checkout.email"]}</label>
            <input
              id="ck-email"
              type="email"
              autoComplete="email"
              maxLength={120}
              placeholder={t["checkout.email.ph"]}
              value={form.email}
              onChange={set("email")}
              aria-invalid={!!errors.email || undefined}
              aria-describedby={describedBy("email")}
            />
            {errorText("email")}
          </div>
          <div className={fieldClass("phone")}>
            <label htmlFor="ck-phone">{t["checkout.phone"]}</label>
            <PhoneField
              lang={lang}
              countries={countries}
              country={location.country}
              inputId="ck-phone"
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
        </fieldset>

        <fieldset className="checkout-card">
          <legend>{t["checkout.shipping.title"]}</legend>
          <LocationFields
            lang={lang}
            countries={countries}
            value={location}
            onChange={(next) => {
              if (next.country !== location.country)
                countryTouched.current = true;
              setLocation(next);
            }}
            onModeChange={setRegionMode}
            errors={{
              country: errors.country,
              department: errors.department,
              city: errors.city,
            }}
            idPrefix="ck"
            strings={{
              country: t["checkout.country"],
              department: t["checkout.department"],
              city: t["checkout.city"],
              countryPlaceholder: countryStrings.placeholder,
              departmentPlaceholder:
                regionMode === "text"
                  ? t["checkout.department.ph"]
                  : regionMode === "list"
                    ? t["checkout.state.select"]
                    : t["checkout.department.select"],
              cityPlaceholder:
                regionMode === "divipola"
                  ? t["checkout.city.select"]
                  : t["checkout.city.ph"],
              cityPickDepartmentFirst: t["checkout.city.pickDepartmentFirst"],
              search: t["checkout.list.search"],
              empty: t["checkout.list.empty"],
            }}
          />
          <div className={fieldClass("address")}>
            <label htmlFor="ck-address">{t["checkout.address"]}</label>
            <input
              id="ck-address"
              type="text"
              autoComplete="street-address"
              maxLength={200}
              placeholder={t["checkout.address.ph"]}
              value={form.address}
              onChange={set("address")}
              aria-invalid={!!errors.address || undefined}
              aria-describedby={describedBy("address")}
            />
            {errorText("address")}
          </div>
          <div className="ck-field">
            <label htmlFor="ck-notes">{t["checkout.notes"]}</label>
            <textarea
              id="ck-notes"
              rows={2}
              maxLength={300}
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
