"use client";

import type { StoredView } from "@/lib/viewPreference";

/**
 * The List/Carousel(/Map) pill switcher itself — shared by SwipeCardList's
 * own built-in toggle and ListOrCarousel, which otherwise drew the same
 * three buttons twice. A caller that never passes `hasMap` just gets the
 * original two-button row.
 */
export function ViewToggle({
  view,
  onChange,
  hasMap = false,
}: {
  view: StoredView;
  onChange: (view: StoredView) => void;
  hasMap?: boolean;
}) {
  return (
    <div className="flex rounded-full bg-b2b-purple/10 p-1">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
          view === "list" ? "bg-b2b-pink text-white" : "text-b2b-ink/55"
        }`}
      >
        List
      </button>
      <button
        type="button"
        onClick={() => onChange("carousel")}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
          view === "carousel" ? "bg-b2b-pink text-white" : "text-b2b-ink/55"
        }`}
      >
        Carousel
      </button>
      {hasMap && (
        <button
          type="button"
          onClick={() => onChange("map")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            view === "map" ? "bg-b2b-pink text-white" : "text-b2b-ink/55"
          }`}
        >
          Map
        </button>
      )}
    </div>
  );
}
