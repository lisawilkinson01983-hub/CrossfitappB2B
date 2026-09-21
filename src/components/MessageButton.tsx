"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MessageButton({ targetUserId }: { targetUserId: string }) {
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

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
    >
      {busy ? "..." : "Message"}
    </button>
  );
}
