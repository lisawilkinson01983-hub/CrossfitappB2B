"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ParticipateButton({
  eventId,
  initialParticipating,
}: {
  eventId: string;
  initialParticipating: boolean;
}) {
  const router = useRouter();
  const [participating, setParticipating] = useState(initialParticipating);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const res = await fetch(`/api/events/${eventId}/participate`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const body = await res.json();
      setParticipating(body.participating);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
        participating
          ? "border border-gray-300 text-gray-700 hover:bg-gray-100"
          : "bg-b2b-pink text-white hover:bg-b2b-pink-dark"
      }`}
    >
      {busy ? "..." : participating ? "I'm in ✓" : "I'm participating"}
    </button>
  );
}
