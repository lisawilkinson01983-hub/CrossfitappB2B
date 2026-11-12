"use client";

import { useRef, useState } from "react";
import { ExpandableImage } from "@/components/ExpandableImage";
import type { PostMediaItem } from "@/components/PostCard";

// `heightClassName` only ever applies to the photo branch — a video sizes
// its own height (see MediaItem) since the photo's cap would otherwise
// recreate the narrow-with-empty-space problem a width-driven video avoids.
function MediaItem({
  item,
  roundedClassName,
  heightClassName,
}: {
  item: PostMediaItem;
  roundedClassName: string;
  heightClassName: string;
}) {
  return item.kind === "VIDEO" ? (
    // Width-driven (capped to a phone-sized column, mx-auto to center it in
    // a wider card), not the photo's w-full/object-cover — a vertical video
    // otherwise gets capped by height first and ends up narrow with empty
    // space either side. Height is left unconstrained so it follows the
    // video's real aspect ratio rather than getting distorted or
    // letterboxed to hit a height cap.
    <video
      controls
      poster={item.thumbnail ?? undefined}
      preload="metadata"
      className={`mx-auto block w-full max-w-[420px] ${roundedClassName}`}
    >
      <source src={item.url} />
    </video>
  ) : (
    <ExpandableImage
      src={item.url}
      alt="Post photo"
      className={`w-full object-cover ${heightClassName} ${roundedClassName}`}
    />
  );
}

/** A post's photo(s)/video(s) — a single item renders plainly, more than one becomes a swipeable carousel with dot indicators. */
export function PostMediaCarousel({ items }: { items: PostMediaItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (items.length === 0) return null;

  if (items.length === 1) {
    return <MediaItem item={items[0]} roundedClassName="mt-3 rounded" heightClassName="max-h-96" />;
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
            <MediaItem item={item} roundedClassName="" heightClassName="max-h-96" />
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
