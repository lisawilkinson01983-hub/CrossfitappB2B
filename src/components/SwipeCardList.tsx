"use client";

import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { readStoredView, storeView } from "@/lib/viewPreference";

export type SwipeCardItem = {
  id: string;
  image: string | null;
  // Fallback letter shown (big, on the brand gold-stripe pattern) when there's no image.
  initial: string;
  title: string;
  // Small white glass chips over the photo (and plain text in the list row) — e.g. ability level, an event tag.
  badges?: string[];
  // One line under the title — e.g. "Austin, TX · CrossFit Riverside", a date + location, an address.
  subtitle?: string | null;
  // Tapping the (non-dragged) card, or the list row's name, opens this.
  href?: string;
  // The primary action rendered under the carousel card and (compact) in the list row — Follow/Message/Join buttons etc.
  action?: ReactNode;
  compactAction?: ReactNode;
  // A small icon-only control (e.g. admin edit) shown top-right of the card and the list row.
  cornerAction?: ReactNode;
  // A small badge (e.g. OpenLevelBadge) shown top-left of the carousel card.
  // Carousel only — a 44px list row has no room to spell the word out, so
  // it's deliberately omitted there.
  cornerBadge?: ReactNode;
};

const NO_PHOTO_PATTERN = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(184,132,42,0.22) 0px, rgba(184,132,42,0.22) 2px, transparent 2px, transparent 18px)",
};

const DRAG_THRESHOLD = 90;
const TAP_THRESHOLD = 6;
const FLY_OUT_DISTANCE = 420;
const MAX_DOTS = 10;

/**
 * A browsable set of cards — as a swipeable one-at-a-time carousel (drag,
 * arrows, dots, or a tap-through to `href`) or a plain list, toggled by the
 * viewer. Shared by every "browse profiles/events/affiliates" surface
 * (Discover's Athletes/Events/Affiliates tabs, an event's interested-athlete
 * browser) so the swipe mechanic and its drag physics live in one place.
 */
export function SwipeCardList({
  items,
  emptyMessage,
  label,
  defaultView = "carousel",
  hideHeader = false,
}: {
  items: SwipeCardItem[];
  emptyMessage: string;
  // The count line above the list/carousel toggle (e.g. "6 athletes
  // interested") — a plain string, not a formatter function: this component
  // is rendered from server components that pass items down as props, and a
  // closure can't cross that boundary the way a string can.
  label?: string;
  defaultView?: "carousel" | "list";
  // Skip the label + its own List/Carousel toggle and always render the
  // carousel — for a page that supplies its own bespoke list view and wraps
  // this in ListOrCarousel instead, sharing one toggle between the two.
  hideHeader?: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<"carousel" | "list">(hideHeader ? "carousel" : defaultView);
  const [index, setIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ startX: 0, dx: 0, dragging: false });

  // Restores a previously-chosen List/Carousel view after this component
  // remounts from a navigation — can't be the initial useState value itself
  // (localStorage isn't available during server rendering), so this runs
  // once after mount instead, same as any other "restore a client-only
  // preference" effect.
  useEffect(() => {
    if (hideHeader) return;
    const stored = readStoredView();
    if (stored) setView(stored);
  }, [hideHeader]);

  function changeView(next: "carousel" | "list") {
    setView(next);
    storeView(next);
  }

  // Reset any leftover drag transform instantly whenever the active card
  // changes (including a dot/list jump, which skips the fly-out animation).
  useEffect(() => {
    const el = cardRef.current;
    if (el) {
      el.style.transition = "none";
      el.style.transform = "translateX(0) rotate(0deg)";
      el.style.opacity = "1";
    }
  }, [index]);

  // The set of items can change size (e.g. a filter re-run) out from under
  // an in-range index — clamp rather than point past the end.
  const clampedIndex = Math.min(index, Math.max(0, items.length - 1));

  if (items.length === 0) {
    return <p className="text-sm text-b2b-ink/40">{emptyMessage}</p>;
  }

  const active = items[clampedIndex];
  const canPrev = clampedIndex > 0;
  const canNext = clampedIndex < items.length - 1;

  function flyOut(dir: 1 | -1, after: () => void) {
    const el = cardRef.current;
    if (el) {
      el.style.transition = "transform 220ms ease, opacity 220ms ease";
      el.style.transform = `translateX(${dir * FLY_OUT_DISTANCE}px) rotate(${dir * -18}deg)`;
      el.style.opacity = "0";
    }
    window.setTimeout(after, 220);
  }

  function snapBack() {
    const el = cardRef.current;
    if (el) {
      el.style.transition = "transform 180ms ease, opacity 180ms ease";
      el.style.transform = "translateX(0) rotate(0deg)";
      el.style.opacity = "1";
    }
  }

  function goNext() {
    if (canNext) flyOut(-1, () => setIndex((i) => i + 1));
  }

  function goPrev() {
    if (canPrev) flyOut(1, () => setIndex((i) => i - 1));
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    drag.current = { startX: e.clientX, dx: 0, dragging: true };
    const el = cardRef.current;
    if (el) {
      el.style.transition = "none";
      el.setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current.dragging) return;
    const dx = e.clientX - drag.current.startX;
    drag.current.dx = dx;
    const el = cardRef.current;
    if (el) {
      const rot = Math.max(-12, Math.min(12, dx / 10));
      el.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
      el.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / 400));
    }
  }

  function onPointerUp() {
    if (!drag.current.dragging) return;
    drag.current.dragging = false;
    const dx = drag.current.dx;
    if (Math.abs(dx) < TAP_THRESHOLD) {
      // Barely moved — treat it as a tap on the card, not a swipe attempt.
      if (active.href) router.push(active.href);
      else snapBack();
      return;
    }
    if (dx <= -DRAG_THRESHOLD && canNext) goNext();
    else if (dx >= DRAG_THRESHOLD && canPrev) goPrev();
    else snapBack();
  }

  const showDots = items.length <= MAX_DOTS;

  return (
    <div>
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/45">{label}</p>
          <div className="flex rounded-full bg-b2b-purple/10 p-1">
            <button
              type="button"
              onClick={() => changeView("list")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                view === "list" ? "bg-b2b-pink text-white" : "text-b2b-ink/55"
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => changeView("carousel")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                view === "carousel" ? "bg-b2b-pink text-white" : "text-b2b-ink/55"
              }`}
            >
              Carousel
            </button>
          </div>
        </div>
      )}

      {view === "list" ? (
        <div className="mt-2.5 flex flex-col gap-2">
          {items.map((item, i) => {
            const rowContent = (
              <>
                <Avatar photo={item.image} name={item.title} size={44} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {item.title}
                    {item.badges?.map((badge) => (
                      <span key={badge} className="ml-1.5 text-xs font-medium text-b2b-pink">
                        {badge}
                      </span>
                    ))}
                  </p>
                  {item.subtitle && <p className="truncate text-xs text-b2b-ink/45">{item.subtitle}</p>}
                </div>
              </>
            );
            return (
              <div key={item.id} className="rounded-xl border border-b2b-purple/10 bg-b2b-card p-3">
                <div className="flex items-center gap-2.5">
                  {item.href ? (
                    <Link href={item.href} className="flex min-w-0 flex-1 items-center gap-2.5">
                      {rowContent}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIndex(i);
                        setView("carousel");
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      {rowContent}
                    </button>
                  )}
                  {item.cornerAction}
                  {item.compactAction ?? item.action}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous"
              onClick={goPrev}
              disabled={!canPrev}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-b2b-purple/20 bg-b2b-card disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <div className="flex flex-1 items-center justify-center overflow-hidden">
              <div
                key={active.id}
                ref={cardRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                className="relative w-full max-w-[280px] touch-none select-none overflow-hidden rounded-2xl shadow-lg"
                style={{ height: 440 }}
              >
                <div className="absolute inset-0">
                  {active.image ? (
                    <Image
                      src={active.image}
                      alt=""
                      fill
                      draggable={false}
                      sizes="280px"
                      className="pointer-events-none object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-b2b-ink" style={NO_PHOTO_PATTERN}>
                      <span className="font-display text-9xl leading-none text-b2b-pink/80">
                        {active.initial.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {active.cornerAction && (
                  <div
                    className="absolute right-3 top-3 rounded-full bg-black/35 p-1.5 backdrop-blur-sm"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {active.cornerAction}
                  </div>
                )}

                {active.cornerBadge && <div className="absolute left-3 top-3">{active.cornerBadge}</div>}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-5 pb-5 pt-16 text-left">
                  <p className="text-xl font-bold leading-tight text-white drop-shadow-sm">
                    {active.href ? (
                      <Link href={active.href} className="hover:underline">
                        {active.title}
                      </Link>
                    ) : (
                      active.title
                    )}
                  </p>
                  {active.badges && active.badges.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {active.badges.map((badge) => (
                        <span
                          key={badge}
                          className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur-sm"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  )}
                  {active.subtitle && <p className="mt-1.5 text-xs font-medium text-white/85">{active.subtitle}</p>}
                </div>
              </div>
            </div>

            <button
              type="button"
              aria-label="Next"
              onClick={goNext}
              disabled={!canNext}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-b2b-purple/20 bg-b2b-card disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {active.action && (
            <div key={active.id} className="mt-3 flex justify-center">
              {active.action}
            </div>
          )}

          {showDots && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5" role="tablist" aria-label="Jump to card">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Jump to ${item.title}`}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === clampedIndex ? "w-4 bg-b2b-pink" : "w-1.5 bg-b2b-purple/25"
                  }`}
                />
              ))}
            </div>
          )}
          <p className="mt-1.5 text-center text-[11px] text-b2b-ink/40">
            {clampedIndex + 1} of {items.length} · drag the card, or use the arrows
          </p>
        </div>
      )}
    </div>
  );
}
