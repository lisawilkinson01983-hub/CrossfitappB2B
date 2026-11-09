"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "none" | "member" | "creator" | "invited" | "requested";

/** Shown per-team on an event's Teams page — lets someone not yet on a team ask to join it. */
export function TeamJoinRequestButton({ teamId, initialStatus }: { teamId: string; initialStatus: Status }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/teams/${teamId}/join-request`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    setStatus("requested");
    router.refresh();
  }

  if (status === "member") return <span className="text-xs font-medium text-b2b-purple">✓ You're on this team</span>;
  if (status === "creator") return <span className="text-xs font-medium text-b2b-purple">✓ Your team</span>;
  if (status === "invited") {
    return (
      <span className="text-xs text-b2b-ink/50">
        You've been invited —{" "}
        <a href="/events/mine?tab=teams" className="text-b2b-pink underline">
          respond in My Teams
        </a>
      </span>
    );
  }
  if (status === "requested") return <span className="text-xs text-b2b-ink/50">Request sent</span>;

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="rounded-lg border border-b2b-purple/20 px-3 py-1.5 text-xs font-semibold text-b2b-purple hover:bg-b2b-purple/5 disabled:opacity-50"
      >
        {busy ? "Sending..." : "Request to join"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
