"use client";

import { useState } from "react";
import type { ReactionSummary } from "@/lib/reactions";
import { EmojiPicker } from "@/components/EmojiPicker";
import { SmileyIcon } from "@/components/SmileyIcon";

/**
 * Reaction pills (one per emoji already used, with its count) plus a round
 * smiley trigger opening the full EmojiPicker — deliberately never a "+", so
 * it reads as its own action instead of being mistaken for AttachmentMenu's
 * "+". Used under chat messages, post/event-notice comments and replies, and
 * gallery/PB comments — the caller owns the actual toggle API call.
 */
export function ReactionBar({
  reactions,
  onToggle,
  align = "start",
}: {
  reactions: ReactionSummary[];
  onToggle: (emoji: string) => void;
  /** Which side the picker opens from — "end" for right-aligned (your own) message bubbles. */
  align?: "start" | "end";
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className={`relative flex flex-wrap items-center gap-1.5 ${align === "end" ? "justify-end" : ""}`}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onToggle(r.emoji)}
          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
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
        className="flex h-6 w-6 items-center justify-center rounded-full border border-b2b-purple/15 bg-b2b-card text-b2b-ink/50 hover:bg-b2b-purple/5"
      >
        <SmileyIcon className="h-3.5 w-3.5" />
      </button>

      {pickerOpen && (
        <EmojiPicker
          align={align}
          onSelect={(emoji) => {
            onToggle(emoji);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
