"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { MediaSource } from "@/lib/gallery";

type MediaItem = { key: string; type: "photo" | "video"; url: string; thumbnail?: string | null; source: MediaSource };

function deleteUrl(source: MediaSource): string {
  switch (source.kind) {
    case "postMedia":
      return `/api/posts/${source.postId}/media?mediaId=${source.mediaId}`;
    case "postLegacy":
      return `/api/posts/${source.postId}/media`;
    case "workout":
      return `/api/workouts/${source.workoutId}/media`;
  }
}

export function GalleryLightbox({
  items: initialItems,
  canEdit = false,
  layout = "strip",
}: {
  items: MediaItem[];
  canEdit?: boolean;
  /** "strip": fixed-width tiles in a horizontal scroller (the profile preview). "grid": fills a responsive grid (the full gallery page). */
  layout?: "strip" | "grid";
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [removeTargetKey, setRemoveTargetKey] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openIndex === null || !scrollerRef.current) return;
    const el = scrollerRef.current.children[openIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "instant", inline: "center", block: "nearest" });
  }, [openIndex]);

  useEffect(() => {
    if (openIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight") setOpenIndex((i) => (i !== null ? Math.min(i + 1, items.length - 1) : i));
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i !== null ? Math.max(i - 1, 0) : i));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, items.length]);

  async function confirmRemove() {
    const target = items.find((i) => i.key === removeTargetKey);
    if (!target) return;
    setRemoving(true);
    const res = await fetch(deleteUrl(target.source), { method: "DELETE" });
    setRemoving(false);
    setRemoveTargetKey(null);
    if (!res.ok) return;

    setItems((prev) => prev.filter((i) => i.key !== target.key));
    setOpenIndex((prev) => {
      if (prev === null) return prev;
      const remaining = items.length - 1;
      return remaining <= 0 ? null : Math.min(prev, remaining - 1);
    });
    router.refresh();
  }

  if (items.length === 0) {
    return <p className="text-b2b-ink/40">No photos or videos left.</p>;
  }

  return (
    <>
      <div
        className={
          layout === "grid"
            ? "grid grid-cols-3 gap-2 sm:grid-cols-4"
            : "flex gap-3 overflow-x-auto pb-1"
        }
      >
        {items.map((item, i) => (
          <div key={item.key} className={`relative ${layout === "strip" ? "flex-shrink-0" : ""}`}>
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              className={`relative aspect-square overflow-hidden rounded-lg bg-b2b-bg ${
                layout === "strip" ? "w-24" : "w-full"
              }`}
            >
              {item.type === "video" ? (
                <>
                  <video
                    src={item.url}
                    muted
                    poster={item.thumbnail ?? undefined}
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white">
                    ▶
                  </span>
                </>
              ) : (
                <Image
                  src={item.url}
                  alt="Uploaded photo"
                  fill
                  sizes={layout === "strip" ? "96px" : "(min-width: 640px) 25vw, 33vw"}
                  className="object-cover"
                />
              )}
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => setRemoveTargetKey(item.key)}
                aria-label="Remove from gallery"
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-sm text-white hover:bg-black/90"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {openIndex !== null && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
          <div className="absolute right-4 top-4 z-10 flex gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => setRemoveTargetKey(items[openIndex].key)}
                aria-label="Remove from gallery"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                🗑
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpenIndex(null)}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
            >
              ×
            </button>
          </div>

          <div ref={scrollerRef} className="flex h-full w-full snap-x snap-mandatory overflow-x-auto">
            {items.map((item) => (
              <div
                key={item.key}
                className="relative flex h-full w-full flex-shrink-0 snap-center items-center justify-center px-4"
              >
                {item.type === "video" ? (
                  <video
                    src={item.url}
                    controls
                    autoPlay
                    poster={item.thumbnail ?? undefined}
                    className="max-h-full max-w-full"
                  />
                ) : (
                  <Image
                    src={item.url}
                    alt="Uploaded photo"
                    fill
                    sizes="100vw"
                    className="object-contain"
                  />
                )}
              </div>
            ))}
          </div>

          {items.length > 1 && (
            <p className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-sm text-white/60">
              Swipe or scroll to view more
            </p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={removeTargetKey !== null}
        title="Remove this from your gallery?"
        message="This removes the photo/video itself — if it's part of a post or logged workout, that post or workout stays, just without this media."
        confirmLabel="Remove"
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTargetKey(null)}
        confirming={removing}
      />
    </>
  );
}
