"use client";

import { useState } from "react";
import { ReactionBar } from "@/components/ReactionBar";
import type { ReactionSummary } from "@/lib/reactions";

/** Reaction pills for a numbered EventWorkout entry — same toggle pattern as comment/notice-board reactions, just scoped to a workout instead. */
export function EventWorkoutReactions({
  eventWorkoutId,
  initialReactions,
}: {
  eventWorkoutId: string;
  initialReactions: ReactionSummary[];
}) {
  const [reactions, setReactions] = useState(initialReactions);

  async function toggle(emoji: string) {
    const res = await fetch(`/api/event-workouts/${eventWorkoutId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const body: { emoji: string; reacted: boolean; reactions: { emoji: string; count: number }[] } =
      await res.json();
    const prevByEmoji = new Map(reactions.map((r) => [r.emoji, r.reactedByMe]));
    setReactions(
      body.reactions.map((r) => ({
        emoji: r.emoji,
        count: r.count,
        reactedByMe: r.emoji === body.emoji ? body.reacted : (prevByEmoji.get(r.emoji) ?? false),
      }))
    );
  }

  return <ReactionBar reactions={reactions} onToggle={toggle} />;
}
