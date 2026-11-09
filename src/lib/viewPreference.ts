/**
 * Persists the List/Carousel(/Map) toggle (SwipeCardList, ListOrCarousel)
 * across navigation — these components live inside server-rendered pages
 * where submitting a search/filter form or switching a Discover tab
 * reloads the whole subtree from scratch, which previously reset the
 * choice back to "carousel" every time. One shared key, since a person who
 * picked List expects it to stick everywhere they'd see this toggle, not
 * per-surface. "map" was added later — an older stored "list"/"carousel"
 * value is still valid, nothing to migrate.
 */
const VIEW_STORAGE_KEY = "b2b-list-or-carousel-view";

export type StoredView = "list" | "carousel" | "map";

export function readStoredView(): StoredView | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === "list" || stored === "carousel" || stored === "map" ? stored : null;
  } catch {
    return null;
  }
}

export function storeView(view: StoredView) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Best-effort — a private-browsing quota error just means the choice
    // won't be remembered this time, not worth surfacing to the user.
  }
}
