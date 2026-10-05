"use client";

import { useEffect, useRef, useState } from "react";
import { REACTION_EMOJIS, type ReactionSummary } from "@/lib/reactions";

/**
 * Reaction pills (one per emoji already used, with its count) plus a small
 * "+" button opening a fixed picker of REACTION_EMOJIS. Used under both chat
 * messages and post comments — the caller owns the actual toggle API call.
 */
export function ReactionBar({
  reactions,
  onToggle,
  align = "start",
}: {
  reactions: ReactionSummary[];
  onToggle: (emoji: string) => void;
  /** Which side the "+" picker opens from — "end" for right-aligned (your own) message bubbles. */
  align?: "start" | "end";
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pickerOpen]);

  return (
    <div className={`relative flex flex-wrap items-center gap-1 ${align === "end" ? "justify-end" : ""}`}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onToggle(r.emoji)}
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
            r.reactedByMe
              ? "border-b2b-pink bg-b2b-pink/10 text-b2b-pink"
              : "border-b2b-purple/15 bg-b2b-card text-b2b-ink/70 hover:bg-b2b-purple/5"
          }`}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}

      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        aria-label="Add reaction"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-b2b-purple/15 bg-b2b-card text-xs text-b2b-ink/50 hover:bg-b2b-purple/5"
      >
        +
      </button>

      {pickerOpen && (
        <div
          ref={pickerRef}
          className={`absolute bottom-full z-10 mb-1 flex gap-1 rounded-full border border-b2b-purple/15 bg-white px-2 py-1 shadow-lg ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onToggle(emoji);
                setPickerOpen(false);
              }}
              className="rounded-full p-1 text-base hover:bg-b2b-purple/10"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
