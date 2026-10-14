"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import { Avatar } from "@/components/Avatar";
import { MessageButton } from "@/components/MessageButton";
import { LEVEL_LABELS, LEVEL_TEXT_CLASSES, showsSingleBadge } from "@/lib/labels";
import type { LevelOption } from "@/lib/validation";

export type InterestedAthlete = {
  id: string;
  name: string;
  photo: string | null;
  levels: LevelOption[];
  area: string | null;
  affiliateGym: string | null;
  isSingle: boolean | null;
  showSingleBadge: boolean;
};

// The brand's "no photo" fill — same diagonal gold-on-ink pattern used as the
// banner fallback on a full profile (see ProfileDetails) — so a photo-less
// card still reads as an intentional brand moment, not a blank gap.
const NO_PHOTO_PATTERN = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(184,132,42,0.22) 0px, rgba(184,132,42,0.22) 2px, transparent 2px, transparent 18px)",
};

function LevelTagsInline({ levels }: { levels: LevelOption[] }) {
  return (
    <>
      {levels.map((lvl, i) => (
        <span key={lvl} className={LEVEL_TEXT_CLASSES[lvl]}>
          {i === 0 ? " · " : " / "}
          {LEVEL_LABELS[lvl]}
        </span>
      ))}
    </>
  );
}

const DRAG_THRESHOLD = 90;
const FLY_OUT_DISTANCE = 420;

/**
 * Browse athletes who've marked themselves "interested" in this event — as a
 * swipeable one-at-a-time carousel (drag, arrows, or jump straight to any
 * card via the dots — same ease of "going back" as scanning a list) or as a
 * plain list, toggled by the viewer. Sits above EventNoticesPanel on the
 * find-teammate page: this is for browsing who's already around, posting a
 * request is the separate section below.
 */
export function InterestedAthletesCarousel({ athletes }: { athletes: InterestedAthlete[] }) {
  const [view, setView] = useState<"carousel" | "list">("carousel");
  const [index, setIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ startX: 0, dx: 0, dragging: false });

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

  if (athletes.length === 0) {
    return <p className="text-sm text-b2b-ink/40">No one's marked interested yet — check back later.</p>;
  }

  const active = athletes[index];
  const canPrev = index > 0;
  const canNext = index < athletes.length - 1;

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
    if (dx <= -DRAG_THRESHOLD && canNext) goNext();
    else if (dx >= DRAG_THRESHOLD && canPrev) goPrev();
    else snapBack();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/45">
          {athletes.length} {athletes.length === 1 ? "athlete" : "athletes"} interested
        </p>
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

      {view === "list" ? (
        <div className="mt-2.5 flex flex-col gap-2">
          {athletes.map((a, i) => (
            <div key={a.id} className="rounded-xl border border-b2b-purple/10 bg-b2b-card p-3">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIndex(i);
                    setView("carousel");
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <Avatar photo={a.photo} name={a.name} size={40} showSingleBadge={showsSingleBadge(a)} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {a.name}
                      <LevelTagsInline levels={a.levels} />
                    </p>
                    <p className="truncate text-xs text-b2b-ink/45">
                      {[a.area, a.affiliateGym].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </button>
                <MessageButton targetUserId={a.id} compact />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous athlete"
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
                ref={cardRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                className="relative w-full max-w-[280px] touch-none select-none overflow-hidden rounded-2xl shadow-lg"
                style={{ height: 440 }}
              >
                <div className="absolute inset-0">
                  {active.photo ? (
                    <Image
                      src={active.photo}
                      alt=""
                      fill
                      draggable={false}
                      sizes="280px"
                      className="pointer-events-none object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-b2b-ink" style={NO_PHOTO_PATTERN}>
                      <span className="font-display text-9xl leading-none text-b2b-pink/80">
                        {active.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-5 pb-5 pt-16 text-left">
                  <p className="text-xl font-bold leading-tight text-white drop-shadow-sm">{active.name}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {active.levels.map((lvl) => (
                      <span
                        key={lvl}
                        className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur-sm"
                      >
                        {LEVEL_LABELS[lvl]}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-white/85">
                    {[active.area, active.affiliateGym].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              aria-label="Next athlete"
              onClick={goNext}
              disabled={!canNext}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-b2b-purple/20 bg-b2b-card disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          <div className="mt-3 flex justify-center">
            <MessageButton targetUserId={active.id} />
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5" role="tablist" aria-label="Jump to athlete">
            {athletes.map((a, i) => (
              <button
                key={a.id}
                type="button"
                aria-label={`Jump to ${a.name}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-b2b-pink" : "w-1.5 bg-b2b-purple/25"}`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-center text-[11px] text-b2b-ink/40">
            {index + 1} of {athletes.length} · drag the card, or use the arrows
          </p>
        </div>
      )}
    </div>
  );
}
