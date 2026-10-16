"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Result = {
  deletedUserCount: number;
  removed: {
    comments: number;
    eventNoticeComments: number;
    eventNotices: number;
    workoutComments: number;
    pbComments: number;
  };
};

export function CleanupDeletedButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function handleRun() {
    setError(null);
    setResult(null);
    setRunning(true);

    const res = await fetch("/api/admin/cleanup-deleted-content", { method: "POST" });
    setRunning(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    const body = await res.json();
    setResult(body);
    router.refresh();
  }

  const total = result
    ? Object.values(result.removed).reduce((sum, n) => sum + n, 0)
    : 0;

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
      {result && (
        <div className="rounded-lg border border-b2b-purple/10 bg-b2b-bg p-3 text-sm text-b2b-ink/70">
          {total === 0 ? (
            <p>Nothing left to clean up — {result.deletedUserCount} deleted accounts, all already clear.</p>
          ) : (
            <>
              <p className="font-medium text-b2b-ink">Removed {total} items:</p>
              <ul className="mt-1 list-disc pl-5">
                {result.removed.comments > 0 && <li>{result.removed.comments} feed post comments</li>}
                {result.removed.eventNotices > 0 && <li>{result.removed.eventNotices} event message board posts</li>}
                {result.removed.eventNoticeComments > 0 && (
                  <li>{result.removed.eventNoticeComments} event message board comments</li>
                )}
                {result.removed.workoutComments > 0 && <li>{result.removed.workoutComments} workout comments</li>}
                {result.removed.pbComments > 0 && <li>{result.removed.pbComments} PB comments</li>}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
