/**
 * Persists the List/Carousel toggle (SwipeCardList, ListOrCarousel) across
 * navigation — both components live inside server-rendered pages where
 * submitting a search/filter form or switching a Discover tab reloads the
 * whole subtree from scratch, which previously reset the choice back to
 * "carousel" every time. One shared key, since a person who picked List
 * expects it to stick everywhere they'd see this toggle, not per-surface.
 */
const VIEW_STORAGE_KEY = "b2b-list-or-carousel-view";

export function readStoredView(): "list" | "carousel" | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === "list" || stored === "carousel" ? stored : null;
  } catch {
    return null;
  }
}

export function storeView(view: "list" | "carousel") {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Best-effort — a private-browsing quota error just means the choice
    // won't be remembered this time, not worth surfacing to the user.
  }
}
