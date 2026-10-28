"use client";

import * as React from "react";

import { Combobox, type ComboboxOption } from "@/components/checkout/Combobox";
import {
  fetchGeoCountry,
  useLocalizedCountries,
  type CountryEntry,
} from "@/components/CountryCombobox";
import { dialCodes } from "@/data/dialCodes";
import { formatPhone, normalizeDigits } from "@/lib/checkoutFields";

const MAX_DIGITS = 14;

// Dial codes shared by several countries: the one a pasted number most
// likely belongs to.
const PREFERRED: Record<string, string> = {
  "+1": "US",
  "+7": "RU",
  "+39": "IT",
  "+44": "GB",
  "+47": "NO",
  "+61": "AU",
  "+212": "MA",
  "+262": "RE",
  "+358": "FI",
  "+590": "GP",
  "+599": "CW",
};

/** Country whose dial code opens a pasted "+NN…" number (longest match). */
function countryForPastedNumber(digits: string): string | null {
  let dial: string | null = null;
  for (const d of Object.values(dialCodes)) {
    if (digits.startsWith(d.slice(1)) && (!dial || d.length > dial.length))
      dial = d;
  }
  if (!dial) return null;
  return (
    PREFERRED[dial] ??
    Object.keys(dialCodes).find((code) => dialCodes[code] === dial) ??
    null
  );
}

interface PhoneFieldProps {
  lang: string;
  countries: CountryEntry[];
  /** Initial stored value, e.g. "+57 3001234567". */
  defaultValue?: string;
  /** Called with the stored format ("+57 3001234567"), or "" when empty. */
  onChange?: (stored: string) => void;
  /** Country (alpha-2) the dial code follows until the buyer picks one. */
  country?: string;
  /** Same, read from a hidden input another island keeps (donation form). */
  followCountryInputId?: string;
  /** Default the dial code to the visitor's country (geo lookup). */
  geoDefault?: boolean;
  /** Hidden input the donation form reads. */
  hiddenInputId?: string;
  hiddenName?: string;
  /** id of the number input (labels point at it; errors focus it). */
  inputId: string;
  invalid?: boolean;
  ariaDescribedBy?: string;
  placeholder?: string;
  dialLabel: string;
  searchPlaceholder: string;
  emptyText: string;
}

function initialDialCountry(defaultValue?: string): string {
  const dial = /^(\+\d{1,4}) /.exec(defaultValue || "")?.[1];
  if (dial && dial !== "+57") {
    const match = Object.entries(dialCodes).find(([, d]) => d === dial);
    if (match) return match[0];
  }
  return "CO";
}

// Dial-code picker + digits-only number in one control. Emits the stored
// format "+57 3001234567" so every checkout sends the same shape.
export default function PhoneField({
  lang,
  countries,
  defaultValue,
  onChange,
  country,
  followCountryInputId,
  geoDefault,
  hiddenInputId,
  hiddenName,
  inputId,
  invalid,
  ariaDescribedBy,
  placeholder,
  dialLabel,
  searchPlaceholder,
  emptyText,
}: PhoneFieldProps) {
  const [dialCountry, setDialCountry] = React.useState(() =>
    initialDialCountry(defaultValue)
  );
  const [digits, setDigits] = React.useState(
    () => /^\+\d{1,4} (\d+)$/.exec(defaultValue || "")?.[1] ?? ""
  );
  // Once the buyer picks a dial code by hand or starts typing the number, the
  // country no longer drives it (a typed number belongs to its dial code).
  const dialTouched = React.useRef(false);
  const digitsRef = React.useRef(digits);
  digitsRef.current = digits;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const hiddenRef = React.useRef<HTMLInputElement>(null);

  const followCountry = React.useCallback((code: string | null | undefined) => {
    if (!dialTouched.current && !digitsRef.current && code && dialCodes[code])
      setDialCountry(code);
  }, []);

  React.useEffect(() => {
    followCountry(country);
  }, [country, followCountry]);

  React.useEffect(() => {
    if (!followCountryInputId) return;
    const el = document.getElementById(
      followCountryInputId
    ) as HTMLInputElement | null;
    if (!el) return;
    followCountry(el.value);
    const onCountry = () => followCountry(el.value);
    el.addEventListener("change", onCountry);
    return () => el.removeEventListener("change", onCountry);
  }, [followCountryInputId, followCountry]);

  React.useEffect(() => {
    if (!geoDefault) return;
    let cancelled = false;
    fetchGeoCountry().then((code) => {
      if (!cancelled) followCountry(code);
    });
    return () => {
      cancelled = true;
    };
  }, [geoDefault, followCountry]);

  const dial = dialCodes[dialCountry] || "+57";
  const stored = digits ? formatPhone(dial, digits) : "";

  React.useEffect(() => {
    onChangeRef.current?.(stored);
    hiddenRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [stored]);

  const localized = useLocalizedCountries(lang, countries);
  const options: ComboboxOption[] = React.useMemo(
    () =>
      localized
        .filter((c) => dialCodes[c.code])
        .map((c) => ({
          value: c.code,
          label: `${c.label} (${dialCodes[c.code]})`,
          prefix: c.emoji,
          keywords: `${dialCodes[c.code]} ${c.name}`,
        })),
    [localized]
  );

  const onNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    let next = normalizeDigits(raw);
    // A pasted "+44 7911…" carries its dial code: switch to it and drop it
    // from the number.
    if (raw.trim().startsWith("+")) {
      const pasted = countryForPastedNumber(next);
      if (pasted) {
        dialTouched.current = true;
        // Keep the chosen country when it already has that dial code.
        if (dialCodes[pasted] !== dial) setDialCountry(pasted);
        next = next.slice(dialCodes[pasted].length - 1);
      }
    }
    setDigits(next.slice(0, MAX_DIGITS));
  };

  return (
    <div className="ph-field">
      {hiddenInputId && (
        <input
          ref={hiddenRef}
          type="hidden"
          id={hiddenInputId}
          name={hiddenName}
          value={stored}
          readOnly
        />
      )}
      <Combobox
        options={options}
        value={dialCountry}
        onChange={(code) => {
          dialTouched.current = true;
          setDialCountry(code);
        }}
        placeholder="+57"
        searchPlaceholder={searchPlaceholder}
        emptyText={emptyText}
        ariaLabel={dialLabel}
        triggerClassName="ph-dial"
        contentClassName="w-72"
        renderValue={(o) => (
          <>
            <span className="cc-flag" aria-hidden="true">
              {o.prefix}
            </span>
            <span className="ph-dial-code">{dial}</span>
          </>
        )}
      />
      <input
        id={inputId}
        className="ph-number"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={placeholder}
        value={digits}
        onChange={onNumber}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
      />
    </div>
  );
}
