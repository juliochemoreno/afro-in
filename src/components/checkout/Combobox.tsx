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

export interface ComboboxOption {
  value: string;
  label: string;
  /** Shown before the label (e.g. a flag). */
  prefix?: string;
  /** Extra text the search matches (e.g. ISO code, dial code). */
  keywords?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaDescribedBy?: string;
  ariaLabel?: string;
  /** Renders the selected value in the trigger (defaults to prefix + label). */
  renderValue?: (option: ComboboxOption) => React.ReactNode;
  triggerClassName?: string;
  /** Popover width; defaults to the trigger width. */
  contentClassName?: string;
}

// Searchable select built on Radix Popover + cmdk. Shared by the country,
// department/state, city and dial-code pickers of the checkout forms.
export const Combobox = React.forwardRef<HTMLButtonElement, ComboboxProps>(
  function Combobox(
    {
      options,
      value,
      onChange,
      placeholder,
      searchPlaceholder,
      emptyText,
      id,
      disabled,
      invalid,
      ariaDescribedBy,
      ariaLabel,
      renderValue,
      triggerClassName,
      contentClassName,
    },
    ref
  ) {
    const [open, setOpen] = React.useState(false);
    const selected = options.find((o) => o.value === value);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            aria-describedby={ariaDescribedBy}
            aria-label={ariaLabel}
            disabled={disabled}
            className={cn("cc-trigger", triggerClassName)}
          >
            <span className="cc-value">
              {selected ? (
                renderValue ? (
                  renderValue(selected)
                ) : (
                  <>
                    {selected.prefix && (
                      <span className="cc-flag" aria-hidden="true">
                        {selected.prefix}
                      </span>
                    )}
                    <span className="cc-label">{selected.label}</span>
                  </>
                )
              ) : (
                <span className="cc-placeholder">{placeholder}</span>
              )}
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className={cn("w-(--radix-popover-trigger-width) p-0", contentClassName)}
          align="start"
        >
          <Command
            loop
            filter={(itemValue, search) =>
              itemValue
                .toLocaleLowerCase()
                .normalize("NFD")
                .replace(/\p{M}/gu, "")
                .includes(
                  search
                    .toLocaleLowerCase()
                    .normalize("NFD")
                    .replace(/\p{M}/gu, "")
                )
                ? 1
                : 0
            }
          >
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-[320px]">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={`${o.label} ${o.keywords ?? ""} ${o.value}`}
                    onSelect={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    {o.prefix && (
                      <span className="cc-flag" aria-hidden="true">
                        {o.prefix}
                      </span>
                    )}
                    <span className="flex-1 truncate">{o.label}</span>
                    <CheckIcon
                      className={cn(
                        "size-4 shrink-0",
                        value === o.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
);
