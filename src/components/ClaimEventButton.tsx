"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MAX_NOTE_LENGTH = 1000;

/**
 * Lets anyone request to be recognised as a public event's editor (see
 * Event.claimRequestedById, /api/events/[id]/claim) — for an event that's
 * actually theirs but was pulled in or submitted by someone else. Goes to
 * an admin for approval (see /admin/event-claims), after which the
 * claimant becomes an additional editor alongside the event's existing
 * organizer, not a replacement for them. Expands into a short optional note
 * first, so an admin has something to go on beyond just a name match.
 */
export function ClaimEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim() {
    setRequesting(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setRequesting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap rounded-lg border border-b2b-purple/20 px-3 py-1.5 text-xs font-semibold text-b2b-purple hover:bg-b2b-purple/5"
      >
        Claim this event
      </button>
    );
  }

  return (
    <div className="w-64 rounded-lg border border-b2b-purple/20 bg-b2b-card p-3 text-left">
      <label htmlFor="claim-note" className="text-xs font-semibold text-b2b-ink">
        Why is this your event?
      </label>
      <p className="mt-0.5 text-xs text-b2b-ink/50">
        Add any information that may help us verify your ownership — e.g. a link to the event's social page or
        booking site. Optional, but it speeds up review.
      </p>
      <textarea
        id="claim-note"
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
        rows={3}
        placeholder="e.g. I run CrossFit Uckfield, here's our Instagram @..."
        className="mt-2 w-full resize-none rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-b2b-pink focus:outline-none"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={requesting}
          className="rounded px-2 py-1 text-xs font-medium text-b2b-ink/50 hover:bg-b2b-bg disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleClaim}
          disabled={requesting}
          className="rounded-full bg-b2b-pink px-3 py-1 text-xs font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
        >
          {requesting ? "Submitting..." : "Submit claim"}
        </button>
      </div>
    </div>
  );
}
