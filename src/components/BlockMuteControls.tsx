"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BlockMuteControls({
  targetUserId,
  initialBlocked,
  initialMuted,
}: {
  targetUserId: string;
  initialBlocked: boolean;
  initialMuted: boolean;
}) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(initialBlocked);
  const [muted, setMuted] = useState(initialMuted);
  const [busy, setBusy] = useState<"block" | "mute" | null>(null);

  async function toggleBlock() {
    setBusy("block");
    const res = await fetch(`/api/users/${targetUserId}/block`, { method: blocked ? "DELETE" : "POST" });
    setBusy(null);
    if (res.ok) {
      const body = await res.json();
      setBlocked(body.blocked);
      router.refresh();
    }
  }

  async function toggleMute() {
    setBusy("mute");
    const res = await fetch(`/api/users/${targetUserId}/mute`, { method: muted ? "DELETE" : "POST" });
    setBusy(null);
    if (res.ok) {
      const body = await res.json();
      setMuted(body.muted);
      router.refresh();
    }
  }

  return (
    <div className="flex gap-3 text-xs">
      <button
        type="button"
        onClick={toggleMute}
        disabled={busy !== null}
        className="text-gray-500 hover:underline disabled:opacity-50"
      >
        {busy === "mute" ? "..." : muted ? "Unmute" : "Mute"}
      </button>
      <button
        type="button"
        onClick={toggleBlock}
        disabled={busy !== null}
        className="text-red-600 hover:underline disabled:opacity-50"
      >
        {busy === "block" ? "..." : blocked ? "Unblock" : "Block"}
      </button>
    </div>
  );
}
