"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Same size/shape as the athletes/notice-board buttons below (rounded-xl,
// px-4 py-3, text-sm font-medium) so all four buttons on the event page match.
function pillClass(active: boolean) {
  return `w-full rounded-xl px-4 py-3 text-center text-sm font-medium disabled:opacity-50 ${
    active
      ? "bg-b2b-ink text-white hover:opacity-90"
      : "border border-b2b-purple/15 bg-b2b-card text-b2b-ink hover:border-b2b-purple/30"
  }`;
}

// "I'm participating" and "I'm interested" are mutually exclusive — each
// route enforces that server-side and returns both current states, so a
// click on either button here always leaves both in sync.
export function EventEngagementButtons({
  eventId,
  initialParticipating,
  initialInterested,
}: {
  eventId: string;
  initialParticipating: boolean;
  initialInterested: boolean;
}) {
  const router = useRouter();
  const [participating, setParticipating] = useState(initialParticipating);
  const [interested, setInterested] = useState(initialInterested);
  const [busy, setBusy] = useState<"participate" | "interested" | null>(null);

  async function toggle(kind: "participate" | "interested") {
    setBusy(kind);
    const res = await fetch(`/api/events/${eventId}/${kind}`, { method: "POST" });
    setBusy(null);
    if (res.ok) {
      const body = await res.json();
      setParticipating(body.participating);
      setInterested(body.interested);
      router.refresh();
    }
  }

  return (
    <div className="grid w-full grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => toggle("participate")}
        disabled={busy !== null}
        className={pillClass(participating)}
      >
        {busy === "participate" ? "..." : participating ? "✓ Participating" : "I'm participating"}
      </button>
      <button
        type="button"
        onClick={() => toggle("interested")}
        disabled={busy !== null}
        className={pillClass(interested)}
      >
        {busy === "interested" ? "..." : interested ? "✓ Interested" : "I'm interested"}
      </button>
    </div>
  );
}
