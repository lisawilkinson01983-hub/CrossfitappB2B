"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type MediaItem = { key: string; type: "photo" | "video"; url: string; thumbnail?: string | null };

export function GalleryLightbox({ items }: { items: MediaItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
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

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((item, i) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="relative aspect-square w-24 flex-shrink-0 overflow-hidden rounded-lg bg-b2b-bg"
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
              <Image src={item.url} alt="Uploaded photo" fill sizes="96px" className="object-cover" />
            )}
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
          >
            ×
          </button>

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
    </>
  );
}
