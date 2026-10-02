"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/** Admin-only — permanently deletes an event, then returns to Discover. */
export function DeleteEventButton({ eventId, eventName }: { eventId: string; eventName: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      setConfirmOpen(false);
      return;
    }
    router.push("/discover?view=events");
    router.refresh();
  }

  return (
    <div className="mt-4">
      {error && <p className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Delete this event
      </button>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete this event?"
        message={`This permanently removes "${eventName}" — its notices, Workout posters, participants, and invites all go with it. This can't be undone.`}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        confirming={deleting}
      />
    </div>
  );
}
