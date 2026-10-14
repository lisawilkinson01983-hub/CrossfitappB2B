"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/dates";

export type EventClaimData = {
  id: string;
  name: string;
  organizerName: string;
  requestedBy: { id: string; name: string; email: string };
  claimRequestedAt: string | Date;
};

export function EventClaimCard({ claim }: { claim: EventClaimData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "dismiss") {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/admin/event-claims/${claim.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-b2b-purple/10 bg-b2b-card p-4">
      <p className="font-semibold">{claim.name}</p>
      <p className="text-sm text-b2b-ink/50">Currently organized by {claim.organizerName}</p>
      <p className="mt-1 text-sm text-b2b-ink">
        Claim requested by <span className="font-medium">{claim.requestedBy.name}</span> ({claim.requestedBy.email})
      </p>
      <p className="mt-1 text-xs text-b2b-ink/40">Requested {formatDate(claim.claimRequestedAt)}</p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={() => act("approve")}
          disabled={busy !== null}
          className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy === "approve" ? "Approving..." : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => act("dismiss")}
          disabled={busy !== null}
          className="rounded bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy === "dismiss" ? "Dismissing..." : "Dismiss"}
        </button>
      </div>
    </div>
  );
}
