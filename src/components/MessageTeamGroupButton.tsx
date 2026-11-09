"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Shown to any current member of a confirmed Team (see My Teams) — starts
 * (or reopens) that team's own persistent group chat, named after the team
 * itself (see POST /api/teams/[id]/message-team). Distinct from
 * MessageTeamButton, which messages a merely-*suggested* set of teammates
 * before any Team row exists at all.
 */
export function MessageTeamGroupButton({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/teams/${teamId}/message-team`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    const body = await res.json();
    router.push(`/messages/${body.id}`);
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="rounded-lg border border-b2b-purple/20 px-3 py-1.5 text-xs font-semibold text-b2b-purple hover:bg-b2b-purple/5 disabled:opacity-50"
      >
        {busy ? "Opening..." : "Message team"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
