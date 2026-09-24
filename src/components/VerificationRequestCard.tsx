"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type VerificationRequestData = {
  id: string;
  name: string;
  email: string;
  affiliateGym: string | null;
  verificationRequestedAt: string | Date;
};

export function VerificationRequestCard({ request }: { request: VerificationRequestData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "dismiss") {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/admin/verification-requests/${request.id}`, {
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
      <p className="font-semibold">{request.name}</p>
      <p className="text-sm text-b2b-ink/50">{request.email}</p>
      {request.affiliateGym && (
        <p className="mt-1 text-sm text-b2b-ink">
          Claims to run <span className="font-medium">{request.affiliateGym}</span>
        </p>
      )}
      <p className="mt-1 text-xs text-b2b-ink/40">
        Requested {new Date(request.verificationRequestedAt).toLocaleDateString()}
      </p>

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
