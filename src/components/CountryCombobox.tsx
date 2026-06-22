"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface CountryEntry {
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
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
}

export default function CountryCombobox({
  lang,
  countries,
  name = "country",
  inputId = "country",
  defaultValue = "CO",
  placeholder,
  searchPlaceholder,
  emptyText,
}: CountryComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(defaultValue);

  // Localize country names from their ISO code for the active language.
  // Falls back to the bundled (Spanish) name if the runtime can't resolve it.
  const localized = React.useMemo(() => {
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

  const selected = localized.find((c) => c.code === value);

  // Best-effort geo detection to preselect the donor's country.
  React.useEffect(() => {
    let cancelled = false;
    fetch("https://ipapi.co/json/")
      .then((r) => r.json() as Promise<{ country_code?: string }>)
      .then((d) => {
        if (cancelled || !d.country_code) return;
        if (countries.some((c) => c.code === d.country_code)) {
          setValue(d.country_code as string);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [countries]);

  return (
    <>
      <input type="hidden" name={name} id={inputId} value={value} readOnly />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className="cc-trigger"
          >
            <span className="cc-value">
              {selected ? (
                <>
                  <span className="cc-flag" aria-hidden="true">
                    {selected.emoji}
                  </span>
                  <span>{selected.label}</span>
                </>
              ) : (
                <span className="cc-placeholder">{placeholder}</span>
              )}
            </span>
            <ChevronsUpDownIcon className="size-4 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          <Command
            loop
            filter={(value, search) =>
              value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }
          >
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-[320px]">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {localized.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={`${c.label} ${c.code}`}
                    onSelect={() => {
                      setValue(c.code);
                      setOpen(false);
                    }}
                  >
                    <span className="cc-flag" aria-hidden="true">
                      {c.emoji}
                    </span>
                    <span className="flex-1 truncate">{c.label}</span>
                    <CheckIcon
                      className={cn(
                        "size-4 shrink-0",
                        value === c.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
