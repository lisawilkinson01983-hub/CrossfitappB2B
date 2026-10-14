"use client";

import { useState } from "react";
import { ShareIcon } from "@/components/ShareIcon";

/** Toggles sharing a numbered workout to the current user's main feed (see Post.linkedEventWorkoutId). */
export function EventWorkoutShareButton({
  eventWorkoutId,
  initialShared,
  initialCount,
}: {
  eventWorkoutId: string;
  initialShared: boolean;
  initialCount: number;
}) {
  const [shared, setShared] = useState(initialShared);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const res = await fetch(`/api/event-workouts/${eventWorkoutId}/share`, { method: "POST" });
    setBusy(false);
    if (!res.ok) return;
    const body: { shared: boolean; count: number } = await res.json();
    setShared(body.shared);
    setCount(body.count);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={shared ? "Unshare from feed" : "Share to feed"}
      className={`flex items-center gap-1 text-sm font-medium disabled:opacity-50 ${shared ? "text-b2b-pink" : "text-b2b-ink/60 hover:text-b2b-pink"}`}
    >
      <ShareIcon className="h-5 w-5" />
      {shared ? "Shared to feed" : "Share to feed"}
      {count > 0 && <span className="text-b2b-ink/40">· {count}</span>}
    </button>
  );
}
