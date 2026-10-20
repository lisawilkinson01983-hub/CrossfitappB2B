"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Lets anyone request to be recognised as a public event's editor (see
 * Event.claimRequestedById, /api/events/[id]/claim) — for an event that's
 * actually theirs but was pulled in or submitted by someone else. Goes to
 * an admin for approval (see /admin/event-claims), after which the
 * claimant becomes an additional editor alongside the event's existing
 * organizer, not a replacement for them.
 */
export function ClaimEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim() {
    setRequesting(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/claim`, { method: "POST" });
    setRequesting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={handleClaim}
        disabled={requesting}
        className="text-sm font-medium text-b2b-purple hover:underline disabled:opacity-50"
      >
        {requesting ? "Requesting..." : "Claim this event"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
