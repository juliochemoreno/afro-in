"use client";

import * as React from "react";

import { Combobox, type ComboboxOption } from "@/components/checkout/Combobox";

export interface CountryEntry {
  code: string;
  emoji: string;
  name: string; // fallback name (Spanish, from data file)
}

interface CountryComboboxProps {
  lang: string;
  countries: CountryEntry[];
  /** Hidden input name the surrounding form reads. */
  name?: string;
  /** Hidden input id the surrounding form reads. */
  inputId?: string;
  defaultValue?: string;
  /** Controlled value (ISO alpha-2); omit to let the component keep its own. */
  value?: string;
  onChange?: (code: string) => void;
  /** Preselect the visitor's country from a geo lookup (uncontrolled use). */
  geoDefault?: boolean;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  triggerId?: string;
  invalid?: boolean;
  ariaDescribedBy?: string;
}

/**
 * Country names localized from their ISO code for the active language.
 * Falls back to the bundled (Spanish) name if the runtime can't resolve it.
 */
export function useLocalizedCountries(
  lang: string,
  countries: CountryEntry[]
): (CountryEntry & { label: string })[] {
  return React.useMemo(() => {
    let display: Intl.DisplayNames | null = null;
    try {
      display = new Intl.DisplayNames([lang], { type: "region" });
    } catch {
      display = null;
    }
    return countries
      .map((c) => ({
        ...c,
        label: (display?.of(c.code) || c.name) ?? c.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, lang));
  }, [lang, countries]);
}

let geoPromise: Promise<string | null> | null = null;

/** Best-effort visitor country (ISO alpha-2), fetched once per page. */
export function fetchGeoCountry(): Promise<string | null> {
  if (!geoPromise) {
    geoPromise = fetch("https://ipapi.co/json/")
      .then((r) => r.json() as Promise<{ country_code?: string }>)
      .then((d) => d.country_code || null)
      .catch(() => null);
  }
  return geoPromise;
}

export default function CountryCombobox({
  lang,
  countries,
  name = "country",
  inputId = "country",
  defaultValue = "CO",
  value: controlledValue,
  onChange,
  geoDefault = true,
  placeholder,
  searchPlaceholder,
  emptyText,
  triggerId,
  invalid,
  ariaDescribedBy,
}: CountryComboboxProps) {
  const [ownValue, setOwnValue] = React.useState(defaultValue);
  const value = controlledValue ?? ownValue;
  const hiddenRef = React.useRef<HTMLInputElement>(null);
  const localized = useLocalizedCountries(lang, countries);

  const select = React.useCallback(
    (code: string) => {
      setOwnValue(code);
      onChange?.(code);
    },
    [onChange]
  );

  // Preselect the visitor's country (only while uncontrolled).
  React.useEffect(() => {
    if (!geoDefault || controlledValue !== undefined) return;
    let cancelled = false;
    fetchGeoCountry().then((code) => {
      if (cancelled || !code) return;
      if (countries.some((c) => c.code === code)) select(code);
    });
    return () => {
      cancelled = true;
    };
  }, [countries, geoDefault, controlledValue, select]);

  // Let vanilla-JS forms (donation) react to changes of the hidden input.
  React.useEffect(() => {
    hiddenRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [value]);

  const options: ComboboxOption[] = React.useMemo(
    () =>
      localized.map((c) => ({
        value: c.code,
        label: c.label,
        prefix: c.emoji,
        keywords: c.name,
      })),
    [localized]
  );

  return (
    <>
      <input
        ref={hiddenRef}
        type="hidden"
        name={name}
        id={inputId}
        value={value}
        readOnly
      />
      <Combobox
        id={triggerId}
        options={options}
        value={value}
        onChange={select}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyText={emptyText}
        invalid={invalid}
        ariaDescribedBy={ariaDescribedBy}
      />
    </>
  );
}
