"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EventInterestButton({
  eventId,
  initialInterested,
}: {
  eventId: string;
  initialInterested: boolean;
}) {
  const router = useRouter();
  const [interested, setInterested] = useState(initialInterested);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const res = await fetch(`/api/events/${eventId}/interested`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const body = await res.json();
      setInterested(body.interested);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`w-full rounded-full px-4 py-3 text-sm font-semibold disabled:opacity-50 ${
        interested
          ? "bg-b2b-ink text-white hover:opacity-90"
          : "border border-b2b-purple/15 bg-b2b-card text-b2b-ink hover:border-b2b-purple/30"
      }`}
    >
      {busy ? "..." : interested ? "✓ Interested" : "I'm interested"}
    </button>
  );
}
