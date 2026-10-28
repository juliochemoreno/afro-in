"use client";

import * as React from "react";

import { Combobox, type ComboboxOption } from "@/components/checkout/Combobox";
import {
  useLocalizedCountries,
  type CountryEntry,
} from "@/components/CountryCombobox";

export interface LocationValue {
  /** ISO alpha-2. */
  country: string;
  department: string;
  city: string;
}

type LocationField = keyof LocationValue;

interface Department {
  code: string;
  name: string;
  municipalities: { code: string; name: string }[];
}

// Region lists load on demand so they stay out of the page's initial JS.
let divipolaPromise: Promise<Department[]> | null = null;
function loadDivipola(): Promise<Department[]> {
  divipolaPromise ??= import("@/data/divipola.json").then(
    (m) => m.default as Department[]
  );
  return divipolaPromise;
}

let regionsPromise: Promise<Map<string, string[]>> | null = null;
function loadRegions(): Promise<Map<string, string[]>> {
  regionsPromise ??= import("country-region-data").then(
    (m) =>
      new Map(
        m.allCountries.map(([, code, regions]) => [
          code as string,
          regions.map(([name]) => name),
        ])
      )
  );
  return regionsPromise;
}

/**
 * What the department/state field offers for a country:
 * "divipola" (Colombia), "list" (states from country-region-data) or
 * "text" (no states known: free text, optional).
 */
export type RegionMode = "divipola" | "list" | "text";

interface Strings {
  country: string;
  department: string;
  city: string;
  countryPlaceholder: string;
  departmentPlaceholder: string;
  cityPlaceholder: string;
  cityPickDepartmentFirst: string;
  search: string;
  empty: string;
}

interface LocationFieldsProps {
  lang: string;
  countries: CountryEntry[];
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  /** Reports how the department/state field works for the current country. */
  onModeChange?: (mode: RegionMode) => void;
  errors: Partial<Record<LocationField, string>>;
  /** Prefix for the field ids (`${idPrefix}-country`, …). */
  idPrefix: string;
  strings: Strings;
}

export default function LocationFields({
  lang,
  countries,
  value,
  onChange,
  onModeChange,
  errors,
  idPrefix,
  strings,
}: LocationFieldsProps) {
  const [mode, setMode] = React.useState<RegionMode | null>(null);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [states, setStates] = React.useState<string[]>([]);
  const onModeChangeRef = React.useRef(onModeChange);
  onModeChangeRef.current = onModeChange;

  // Load the region list for the selected country; ignore stale results when
  // the country changes again before the data arrives.
  React.useEffect(() => {
    let cancelled = false;
    setMode(null);
    const apply = (m: RegionMode) => {
      if (cancelled) return;
      setMode(m);
      onModeChangeRef.current?.(m);
    };
    if (value.country === "CO") {
      loadDivipola()
        .then((list) => {
          if (cancelled) return;
          setDepartments(list);
          apply("divipola");
        })
        .catch(() => apply("text"));
    } else {
      loadRegions()
        .then((map) => {
          if (cancelled) return;
          const list = map.get(value.country) ?? [];
          setStates(list);
          apply(list.length > 1 ? "list" : "text");
        })
        .catch(() => apply("text"));
    }
    return () => {
      cancelled = true;
    };
  }, [value.country]);

  const localized = useLocalizedCountries(lang, countries);
  const countryOptions: ComboboxOption[] = React.useMemo(
    () =>
      localized.map((c) => ({
        value: c.code,
        label: c.label,
        prefix: c.emoji,
        keywords: c.name,
      })),
    [localized]
  );

  const departmentOptions: ComboboxOption[] = React.useMemo(() => {
    if (mode === "divipola")
      return departments.map((d) => ({ value: d.name, label: d.name }));
    if (mode === "list") return states.map((s) => ({ value: s, label: s }));
    return [];
  }, [mode, departments, states]);

  const cityOptions: ComboboxOption[] = React.useMemo(() => {
    if (mode !== "divipola") return [];
    const dept = departments.find((d) => d.name === value.department);
    return (dept?.municipalities ?? []).map((m) => ({
      value: m.name,
      label: m.name,
    }));
  }, [mode, departments, value.department]);

  const id = (f: LocationField) => `${idPrefix}-${f}`;
  const errId = (f: LocationField) => `${idPrefix}-${f}-error`;
  const fieldClass = (f: LocationField) =>
    errors[f] ? "ck-field is-invalid" : "ck-field";
  const errorText = (f: LocationField) =>
    errors[f] ? (
      <p className="ck-field-error" id={errId(f)}>
        {errors[f]}
      </p>
    ) : null;

  const set = (patch: Partial<LocationValue>) => onChange({ ...value, ...patch });

  return (
    <>
      <div className={fieldClass("country")}>
        <label htmlFor={id("country")}>{strings.country}</label>
        <Combobox
          id={id("country")}
          options={countryOptions}
          value={value.country}
          onChange={(country) =>
            country !== value.country &&
            set({ country, department: "", city: "" })
          }
          placeholder={strings.countryPlaceholder}
          searchPlaceholder={strings.search}
          emptyText={strings.empty}
          invalid={!!errors.country}
          ariaDescribedBy={errors.country ? errId("country") : undefined}
        />
        {errorText("country")}
      </div>
      <div className="ck-row">
        <div className={fieldClass("department")}>
          <label htmlFor={id("department")}>{strings.department}</label>
          {mode === "divipola" || mode === "list" ? (
            <Combobox
              id={id("department")}
              options={departmentOptions}
              value={value.department}
              onChange={(department) =>
                department !== value.department &&
                set({ department, city: mode === "divipola" ? "" : value.city })
              }
              placeholder={strings.departmentPlaceholder}
              searchPlaceholder={strings.search}
              emptyText={strings.empty}
              invalid={!!errors.department}
              ariaDescribedBy={
                errors.department ? errId("department") : undefined
              }
            />
          ) : (
            <input
              id={id("department")}
              type="text"
              autoComplete="address-level1"
              maxLength={80}
              disabled={mode === null}
              placeholder={strings.departmentPlaceholder}
              value={value.department}
              onChange={(e) => set({ department: e.target.value })}
              aria-invalid={!!errors.department || undefined}
              aria-describedby={
                errors.department ? errId("department") : undefined
              }
            />
          )}
          {errorText("department")}
        </div>
        <div className={fieldClass("city")}>
          <label htmlFor={id("city")}>{strings.city}</label>
          {mode === "divipola" ? (
            <Combobox
              id={id("city")}
              options={cityOptions}
              value={value.city}
              onChange={(city) => set({ city })}
              disabled={!value.department}
              placeholder={
                value.department
                  ? strings.cityPlaceholder
                  : strings.cityPickDepartmentFirst
              }
              searchPlaceholder={strings.search}
              emptyText={strings.empty}
              invalid={!!errors.city}
              ariaDescribedBy={errors.city ? errId("city") : undefined}
            />
          ) : (
            <input
              id={id("city")}
              type="text"
              autoComplete="address-level2"
              maxLength={80}
              disabled={mode === null}
              placeholder={strings.cityPlaceholder}
              value={value.city}
              onChange={(e) => set({ city: e.target.value })}
              aria-invalid={!!errors.city || undefined}
              aria-describedby={errors.city ? errId("city") : undefined}
            />
          )}
          {errorText("city")}
        </div>
      </div>
    </>
  );
}
