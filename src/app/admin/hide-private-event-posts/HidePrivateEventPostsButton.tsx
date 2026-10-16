"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function HidePrivateEventPostsButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiddenCount, setHiddenCount] = useState<number | null>(null);

  async function handleRun() {
    setError(null);
    setHiddenCount(null);
    setRunning(true);

    const res = await fetch("/api/admin/hide-private-event-posts", { method: "POST" });
    setRunning(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    const body = await res.json();
    setHiddenCount(body.hiddenCount);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="button"
        onClick={handleRun}
        disabled={running}
        className="self-start rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
      >
        {running ? "Cleaning up..." : "Run cleanup"}
      </button>
      {hiddenCount !== null && (
        <div className="rounded-lg border border-b2b-purple/10 bg-b2b-bg p-3 text-sm text-b2b-ink/70">
          {hiddenCount === 0 ? (
            <p>Nothing left to clean up — no leftover private-event posts in the feed.</p>
          ) : (
            <p>
              Removed {hiddenCount} private-event {hiddenCount === 1 ? "post" : "posts"} from the feed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
