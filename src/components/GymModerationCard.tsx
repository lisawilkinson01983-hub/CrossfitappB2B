"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export type GymModerationData = {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  website: string | null;
  photo: string | null;
  submittedBy: { id: string; name: string; email: string } | null;
};

export function GymModerationCard({ gym }: { gym: GymModerationData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function moderate(action: "approve" | "reject") {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/gyms/${gym.id}/moderate`, {
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
      <div className="flex items-start gap-3">
        {gym.photo && (
          <Image src={gym.photo} alt={gym.name} width={64} height={64} className="rounded object-cover" />
        )}
        <div>
          <p className="font-semibold">{gym.name}</p>
          {gym.address && <p className="text-sm text-b2b-ink/50">{gym.address}</p>}
          {gym.submittedBy && (
            <p className="text-xs text-b2b-ink/40">
              Submitted by {gym.submittedBy.name} ({gym.submittedBy.email})
            </p>
          )}
        </div>
      </div>

      {gym.description && <p className="mt-2 text-sm text-b2b-ink/70">{gym.description}</p>}

      {gym.website && (
        <a
          href={gym.website}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-b2b-pink underline"
        >
          {gym.website}
        </a>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={() => moderate("approve")}
          disabled={busy !== null}
          className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy === "approve" ? "Approving..." : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => moderate("reject")}
          disabled={busy !== null}
          className="rounded bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy === "reject" ? "Rejecting..." : "Reject"}
        </button>
      </div>
    </div>
  );
}
