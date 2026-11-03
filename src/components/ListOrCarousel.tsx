"use client";

import { useEffect, useState, type ReactNode } from "react";
import { readStoredView, storeView, type StoredView } from "@/lib/viewPreference";
import { ViewToggle } from "@/components/ViewToggle";

/**
 * A List/Carousel(/Map) toggle that lets the caller supply its own bespoke
 * list markup instead of SwipeCardList's generic compact rows — for a
 * surface (like Discover's Events tab) where the existing list view already
 * carries more detail (description, participant count, the full
 * engagement-button grid) than the generic row has room for. Pass a
 * <SwipeCardList hideHeader /> as `carousel` so the two share one toggle
 * instead of each drawing its own.
 */
export function ListOrCarousel({
  label,
  list,
  carousel,
  map,
  defaultView = "carousel",
}: {
  label: string;
  list: ReactNode;
  carousel: ReactNode;
  // A pre-built map view (e.g. <DiscoverMap />) — when supplied, the toggle
  // grows a third "Map" button.
  map?: ReactNode;
  defaultView?: StoredView;
}) {
  const [view, setView] = useState<StoredView>(defaultView);

  // See SwipeCardList's identical effect — restores a previously-chosen
  // view after a navigation remounts this component, which can't happen via
  // the initial useState value since localStorage isn't available during
  // server rendering.
  useEffect(() => {
    const stored = readStoredView();
    if (stored) setView(stored);
  }, []);

  function changeView(next: StoredView) {
    setView(next);
    storeView(next);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/45">{label}</p>
        <ViewToggle view={view} onChange={changeView} hasMap={!!map} />
      </div>
      <div className="mt-2.5">{view === "map" && map ? map : view === "list" ? list : carousel}</div>
    </div>
  );
}
