"use client";

import { useState, type ReactNode } from "react";

/**
 * A List/Carousel toggle that lets the caller supply its own bespoke list
 * markup instead of SwipeCardList's generic compact rows — for a surface
 * (like Discover's Events tab) where the existing list view already carries
 * more detail (description, participant count, the full engagement-button
 * grid) than the generic row has room for. Pass a <SwipeCardList
 * hideHeader /> as `carousel` so the two share one toggle instead of each
 * drawing its own.
 */
export function ListOrCarousel({
  label,
  list,
  carousel,
  defaultView = "carousel",
}: {
  label: string;
  list: ReactNode;
  carousel: ReactNode;
  defaultView?: "list" | "carousel";
}) {
  const [view, setView] = useState<"list" | "carousel">(defaultView);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/45">{label}</p>
        <div className="flex rounded-full bg-b2b-purple/10 p-1">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              view === "list" ? "bg-b2b-pink text-white" : "text-b2b-ink/55"
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setView("carousel")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              view === "carousel" ? "bg-b2b-pink text-white" : "text-b2b-ink/55"
            }`}
          >
            Carousel
          </button>
        </div>
      </div>
      <div className="mt-2.5">{view === "list" ? list : carousel}</div>
    </div>
  );
}
