"use client";

import { useState } from "react";
import { APP_THEMES, type AppThemeOption } from "@/lib/validation";
import { APP_THEME_LABELS, APP_THEME_SWATCHES } from "@/lib/labels";

export function ThemeSwitcher({ initialTheme }: { initialTheme: AppThemeOption }) {
  const [theme, setTheme] = useState(initialTheme);
  const [busy, setBusy] = useState(false);

  async function selectTheme(value: AppThemeOption) {
    if (value === theme || busy) return;
    setBusy(true);
    const res = await fetch("/api/settings/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: value }),
    });
    if (res.ok) {
      // The theme is applied via a data-theme attribute on <html> in the
      // root layout — router.refresh() doesn't reliably re-apply attributes
      // on that root element, so a full reload is the reliable way to see
      // it take effect immediately.
      window.location.reload();
      return;
    }
    setBusy(false);
  }

  return (
    <div className="flex gap-3">
      {APP_THEMES.map((option) => {
        const selected = option === theme;
        return (
          <button
            key={option}
            type="button"
            onClick={() => selectTheme(option)}
            disabled={busy}
            className={`flex flex-1 flex-col items-center gap-2 rounded-lg border p-3 text-sm font-medium disabled:opacity-50 ${
              selected
                ? "border-b2b-pink bg-b2b-pink/5"
                : "border-b2b-purple/10 hover:border-b2b-pink/40"
            }`}
          >
            <span className="flex gap-1">
              {APP_THEME_SWATCHES[option].map((color) => (
                <span
                  key={color}
                  className="h-6 w-6 rounded-full border border-black/5"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
            <span>{APP_THEME_LABELS[option]}</span>
            {selected && <span className="text-xs font-normal text-b2b-pink">Selected</span>}
          </button>
        );
      })}
    </div>
  );
}
