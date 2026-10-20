"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const LAST_PATHNAME_KEY = "b2b-last-pathname";
const HAS_NAVIGATED_KEY = "b2b-has-navigated";

/**
 * Marks, in sessionStorage, once this tab has moved on from its very first
 * page to a second one — BackLink reads this to decide whether router.back()
 * is safe to try at all. Without it, a deep link opened as the first page in
 * a fresh tab (e.g. from a notification) has nothing real behind it in
 * history except the browser's own blank initial document, and calling
 * back() there navigates to (and destroys the page on) "about:blank" rather
 * than going anywhere useful — this flag lets BackLink skip straight to its
 * fallback href instead of ever trying that.
 *
 * Keyed off sessionStorage's own persisted "last pathname" rather than a
 * React ref, since a ref resets on every full page load (a hard refresh, a
 * typed URL, an external link) — not just the tab's actual first one — and
 * would otherwise forget that this tab had already moved on.
 *
 * Mounted once, high in the tree (see Providers) — ignores query-string-only
 * changes (tab switches, filters) on purpose, since those never change
 * whether a real previous in-app page exists to go back to.
 */
export function NavDepthTracker() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      const lastPathname = sessionStorage.getItem(LAST_PATHNAME_KEY);
      if (lastPathname !== null && lastPathname !== pathname) {
        sessionStorage.setItem(HAS_NAVIGATED_KEY, "1");
      }
      sessionStorage.setItem(LAST_PATHNAME_KEY, pathname);
    } catch {
      // Private-browsing/blocked storage — BackLink's own reactive timeout
      // fallback still covers us, just without this proactive check.
    }
  }, [pathname]);

  return null;
}
