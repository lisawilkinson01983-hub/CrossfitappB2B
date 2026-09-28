"use client";

import { useRef, useState } from "react";
import { ExpandableImage } from "@/components/ExpandableImage";
import type { PostMediaItem } from "@/components/PostCard";

function MediaItem({ item, className }: { item: PostMediaItem; className: string }) {
  return item.kind === "VIDEO" ? (
    // mx-auto + w-auto (not the photo's w-full/object-cover) so a vertical
    // phone video sizes to its own aspect ratio instead of getting
    // letterboxed with black bars inside a forced-wide box.
    <video
      controls
      poster={item.thumbnail ?? undefined}
      preload="metadata"
      className={`mx-auto block w-auto max-w-full ${className}`}
    >
      <source src={item.url} />
    </video>
  ) : (
    <ExpandableImage src={item.url} alt="Post photo" className={`w-full object-cover ${className}`} />
  );
}

/** A post's photo(s)/video(s) — a single item renders plainly, more than one becomes a swipeable carousel with dot indicators. */
export function PostMediaCarousel({ items }: { items: PostMediaItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (items.length === 0) return null;

  if (items.length === 1) {
    return <MediaItem item={items[0]} className="mt-3 max-h-96 rounded" />;
  }

  function handleScroll() {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div className="mt-3">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto rounded"
      >
        {items.map((item) => (
          <div key={item.id} className="w-full shrink-0 snap-center">
            <MediaItem item={item} className="max-h-96" />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-1.5">
        {items.map((item, i) => (
          <span
            key={item.id}
            className={`h-1.5 w-1.5 rounded-full ${i === activeIndex ? "bg-b2b-pink" : "bg-b2b-purple/20"}`}
          />
        ))}
      </div>
    </div>
  );
}
