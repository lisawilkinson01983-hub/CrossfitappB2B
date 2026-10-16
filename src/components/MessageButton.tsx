"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MessageButton({
  targetUserId,
  compact,
  fullWidth,
}: {
  targetUserId: string;
  /** Smaller padding/text for tight list rows (e.g. the followers/following list). */
  compact?: boolean;
  /** A full-width gold pill alongside Follow — the profile page's own action row. */
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

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

  const className = fullWidth
    ? "flex-1 rounded-xl bg-b2b-pink py-2.5 text-center text-sm font-semibold text-white hover:bg-b2b-pink-dark disabled:opacity-60"
    : `whitespace-nowrap rounded bg-b2b-purple font-medium text-white hover:bg-b2b-purple-dark disabled:opacity-50 ${compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"}`;

  return (
    <button type="button" onClick={handleClick} disabled={busy} className={className}>
      {busy ? "..." : "Message"}
    </button>
  );
}
