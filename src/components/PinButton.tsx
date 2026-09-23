"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PinButton({ endpoint, initialPinned }: { endpoint: string; initialPinned: boolean }) {
  const router = useRouter();
  const [pinned, setPinned] = useState(initialPinned);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const res = await fetch(endpoint, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const body = await res.json();
      setPinned(body.pinned);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={pinned ? "Unpin" : "Pin to top"}
      className={`text-xs font-medium disabled:opacity-50 ${
        pinned ? "text-b2b-pink" : "text-b2b-ink/40 hover:text-b2b-ink"
      }`}
    >
      {busy ? "..." : pinned ? "📌 Pinned" : "📌 Pin"}
    </button>
  );
}
