"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Undoes a still-pending "claim this event" request — e.g. clicked by accident. Only shown while it's still awaiting admin review. */
export function UndoClaimButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/events/${eventId}/claim`, { method: "DELETE" }).catch(() => {});
        setBusy(false);
        router.refresh();
      }}
      className="text-xs font-medium text-b2b-ink/40 underline hover:text-b2b-ink/70 disabled:opacity-50"
    >
      {busy ? "Undoing..." : "Undo"}
    </button>
  );
}
