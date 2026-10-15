"use client";

import { useState, type ReactNode } from "react";
import { SearchIcon } from "@/components/SearchIcon";

/**
 * Collapses a page's primary search bar (and whatever filters/submit button
 * come with it) down to a narrow icon-only affordance, expanding to the real
 * form on tap — the same "small control opens into the full thing" shape as
 * the messaging composer. Starts open whenever a search/filter from the
 * current URL is already active, so an applied search is never hidden from
 * the person who ran it.
 */
export function CollapsibleSearch({
  label,
  defaultOpen,
  children,
}: {
  // Shown on the collapsed bar, e.g. "Search athletes by name".
  label: string;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-full border border-gray-300 bg-b2b-card px-4 py-2.5 text-left text-sm text-b2b-ink/45"
      >
        <SearchIcon className="h-4 w-4 shrink-0 text-b2b-ink/40" />
        <span className="truncate">{label}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mb-2 flex items-center gap-1.5 text-xs font-medium text-b2b-ink/40"
      >
        <SearchIcon className="h-3.5 w-3.5" />
        Hide search
      </button>
      {children}
    </div>
  );
}
