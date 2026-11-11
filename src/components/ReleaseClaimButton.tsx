"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Lets the claimant give up an already-approved "claim this event" (see Event.claimedById) — e.g. it wasn't meant to be approved, or they no longer want editor access. */
export function ReleaseClaimButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Release your claim on this event? You'll lose editor access to it.")) return;
        setBusy(true);
        await fetch(`/api/events/${eventId}/claim`, { method: "DELETE" }).catch(() => {});
        setBusy(false);
        router.refresh();
      }}
      className="text-xs font-medium text-b2b-ink/40 underline hover:text-b2b-ink/70 disabled:opacity-50"
    >
      {busy ? "Releasing..." : "Release claim"}
    </button>
  );
}
