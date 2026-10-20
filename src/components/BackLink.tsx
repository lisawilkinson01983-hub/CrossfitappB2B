"use client";

import { useRouter } from "next/navigation";
import { BackIcon } from "@/components/BackIcon";

/**
 * A "go back" link — just the arrow icon, no visible "Back to X" label
 * cluttering the top of every screen. `children` (what every call site
 * already passes, e.g. "Back to feed") becomes the icon's accessible name
 * instead of being printed out, so screen readers still announce where it
 * goes without sighted users having to read it.
 *
 * Tapping it replays actual browser history (router.back()) rather than
 * always landing on `href` — so it returns to wherever the person really
 * came from (a search with filters applied, a specific Discover tab, a
 * scrolled-to spot in the feed), not just this page's nominal parent.
 * `href` is only a fallback, used when there's nothing to go back to in
 * this tab — e.g. the page was opened directly from a notification, a
 * shared link, or as the very first screen after installing the PWA.
 */
export function BackLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Let a modifier/middle click open `href` in a new tab as normal —
    // only the plain left click gets the smart "go back" behavior.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();

    // Nothing real to go back to yet in this tab (see NavDepthTracker) —
    // calling back() here would land on the browser's blank initial
    // document instead of anywhere useful, so skip straight to the fallback.
    let hasNavigated = false;
    try {
      hasNavigated = sessionStorage.getItem("b2b-has-navigated") === "1";
    } catch {
      // Private-browsing/blocked storage — fall through to the reactive
      // check below instead of assuming either way.
      hasNavigated = true;
    }
    if (!hasNavigated) {
      router.push(href);
      return;
    }

    const startUrl = window.location.href;
    router.back();
    // router.back() is fire-and-forget with no way to know up front whether
    // there was actually anywhere to go — so check shortly after whether the
    // URL actually changed, and fall back to `href` if it didn't.
    setTimeout(() => {
      if (window.location.href === startUrl) {
        router.push(href);
      }
    }, 150);
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      aria-label={typeof children === "string" ? children : undefined}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-b2b-purple/15 text-b2b-ink/60 hover:bg-b2b-bg ${className}`}
    >
      <BackIcon className="h-3 w-3 shrink-0" />
    </a>
  );
}
