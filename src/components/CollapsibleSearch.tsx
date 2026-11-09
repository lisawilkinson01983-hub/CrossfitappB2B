"use client";

import { useState, type ReactNode } from "react";
import { SearchIcon } from "@/components/SearchIcon";

/**
 * A page's primary search bar (and whatever filters/submit button come with
 * it), collapsed down to a slim, icon-led bar that pops the real form out
 * into an overlay on tap instead of folding it down inline — so a long
 * filter set never pushes the page's own content (a carousel, a list)
 * further down the screen. `defaultOpen` no longer auto-opens that overlay
 * (that would just trade one kind of clutter for another on every load) —
 * it instead marks the collapsed bar itself as "a search/filter is active"
 * with a small dot, so that's visible at a glance without forcing the
 * overlay open.
 *
 * `variant="icon"` swaps the labeled bar for a small round icon-only button
 * — for Discover's tabs, where that trigger shares a row with the tabs
 * themselves instead of getting its own line.
 */
export function CollapsibleSearch({
  label,
  defaultOpen,
  children,
  variant = "bar",
}: {
  // Shown on the collapsed bar (or as this button's accessible name in icon
  // variant), e.g. "Search athletes by name".
  label: string;
  defaultOpen: boolean;
  children: ReactNode;
  variant?: "bar" | "icon";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
            defaultOpen ? "border-b2b-pink/30 bg-b2b-pink/5" : "border-gray-300 bg-b2b-card"
          }`}
        >
          <SearchIcon className="h-3.5 w-3.5 text-b2b-ink/50" />
          {defaultOpen && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-b2b-pink" />}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex w-full items-center gap-2 rounded-full border px-3 py-1.5 text-left text-sm ${
            defaultOpen
              ? "border-b2b-pink/30 bg-b2b-pink/5 text-b2b-ink/70"
              : "border-gray-300 bg-b2b-card text-b2b-ink/45"
          }`}
        >
          <SearchIcon className="h-3.5 w-3.5 shrink-0 text-b2b-ink/40" />
          <span className="truncate">{label}</span>
          {defaultOpen && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-b2b-pink" />}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-b2b-card p-4 shadow-lg"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-b2b-ink">{label}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 rounded px-1 text-lg leading-none text-b2b-ink/40 hover:text-b2b-ink"
              >
                ×
              </button>
            </div>
            <div className="mt-3">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
