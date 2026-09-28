"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Shown to a private event's organizer — starts (or reopens) the group chat with everyone currently marked as attending. */
export function MessageAttendeesButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/message-attendees`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    const body = await res.json();
    router.push(`/messages/${body.id}`);
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="text-sm text-b2b-pink underline disabled:opacity-50"
      >
        {busy ? "Opening..." : "Message attendees"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
