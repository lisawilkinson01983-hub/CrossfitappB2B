"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GymUpdateNudge({ suggestedGym }: { suggestedGym: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  async function handleSwitch() {
    setBusy(true);
    const res = await fetch("/api/profile/switch-gym", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: suggestedGym }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  if (dismissed) return null;

  return (
    <div className="mt-4 flex items-center justify-between rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
      <p>
        <strong>{suggestedGym}</strong> is now on our list — switch to it?
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSwitch}
          disabled={busy}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "..." : `Switch to ${suggestedGym}`}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs text-gray-500 hover:underline"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
