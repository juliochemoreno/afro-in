"use client";

import * as React from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
} from "ag-grid-community";
import { AgGridReact, type AgGridReactProps } from "ag-grid-react";

import { cn } from "@/lib/utils";

// Register all community features once (Theming API — no legacy CSS imports).
ModuleRegistry.registerModules([AllCommunityModule]);

// Theme tuned to the admin: AFRO IN red accent, rounded, Inter font.
const adminTheme = themeQuartz.withParams({
  accentColor: "#e31c25",
  borderRadius: 8,
  wrapperBorderRadius: 12,
  fontFamily: "inherit",
  headerFontWeight: 600,
  rowVerticalPaddingScale: 1.1,
});

// Track the app's dark mode (.dark on <html>) so the grid follows the theme
// toggle live.
function useIsDark() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

interface Props<T> extends AgGridReactProps<T> {
  className?: string;
}

// Full-height grid: fills its flex parent and scrolls internally.
export default function AdminGrid<T>({ className, ...props }: Props<T>) {
  const dark = useIsDark();
  return (
    <div
      className={cn("min-h-0 flex-1", className)}
      data-ag-theme-mode={dark ? "dark" : "light"}
    >
      <AgGridReact<T>
        theme={adminTheme}
        animateRows
        autoSizeStrategy={{ type: "fitGridWidth" }}
        {...props}
        defaultColDef={{
          sortable: true,
          resizable: true,
          filter: true,
          ...props.defaultColDef,
        }}
      />
    </div>
  );
}
