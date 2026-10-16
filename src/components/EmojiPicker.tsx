"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EMOJI_CATEGORIES, searchEmoji } from "@/lib/emoji";

/**
 * The full emoji picker — search box, category tabs, a scrollable grid —
 * used anywhere someone can react with "any emoji" rather than a fixed
 * shortlist (see PostCard's React action and ReactionBar's trigger). Pure
 * Unicode characters rendered via the system font, so there's nothing to
 * load and no network dependency.
 */
export function EmojiPicker({
  onSelect,
  onClose,
  align = "start",
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  align?: "start" | "end";
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0].id);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const searchResults = useMemo(() => searchEmoji(query), [query]);
  const activeEmojis = query.trim()
    ? searchResults
    : EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.emojis ?? [];

  return (
    <div
      ref={ref}
      className={`absolute bottom-full z-30 mb-2 flex h-80 w-72 flex-col overflow-hidden rounded-2xl border border-b2b-purple/15 bg-b2b-card shadow-xl ${
        align === "end" ? "right-0" : "left-0"
      }`}
    >
      <div className="border-b border-b2b-purple/10 p-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emoji"
          autoFocus
          className="w-full rounded-full border border-b2b-purple/15 bg-b2b-bg px-3.5 py-2 text-sm text-b2b-ink placeholder:text-b2b-ink/40 focus:border-b2b-pink focus:outline-none"
        />
      </div>

      {!query.trim() && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-b2b-purple/10 px-3 py-2">
          {EMOJI_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              aria-label={category.label}
              title={category.label}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg ${
                activeCategory === category.id ? "bg-b2b-pink/15" : "hover:bg-b2b-bg"
              }`}
            >
              {category.emojis[0].char}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {activeEmojis.length === 0 ? (
          <p className="mt-6 text-center text-sm text-b2b-ink/40">No emoji found.</p>
        ) : (
          <div className="grid grid-cols-6 gap-1.5">
            {activeEmojis.map((emoji, i) => (
              <button
                key={`${emoji.char}-${i}`}
                type="button"
                onClick={() => onSelect(emoji.char)}
                aria-label={emoji.name}
                title={emoji.name}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl hover:bg-b2b-bg"
              >
                {emoji.char}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
