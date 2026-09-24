"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MessageButton({
  targetUserId,
  compact,
}: {
  targetUserId: string;
  /** Smaller padding/text for tight list rows (e.g. the followers/following list). */
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const sizeClass = compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";

  async function handleClick() {
    setBusy(true);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: targetUserId }),
    });
    setBusy(false);
    if (res.ok) {
      const body = await res.json();
      router.push(`/messages/${body.id}`);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`whitespace-nowrap rounded bg-b2b-purple font-medium text-white hover:bg-b2b-purple-dark disabled:opacity-50 ${sizeClass}`}
    >
      {busy ? "..." : "Message"}
    </button>
  );
}
