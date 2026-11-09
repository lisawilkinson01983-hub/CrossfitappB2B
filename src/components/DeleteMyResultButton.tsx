"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** A small trash icon shown only on the viewer's own result row — deletes it (and any feed post made from it) so they can log it again from scratch. */
export function DeleteMyResultButton({ resultId }: { resultId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      aria-label="Delete this result"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm("Delete this result? If you shared it to the feed, that post goes too. You can log it again afterwards.")) return;
        setBusy(true);
        await fetch(`/api/event-results/${resultId}`, { method: "DELETE" }).catch(() => {});
        router.refresh();
      }}
      className="shrink-0 text-b2b-ink/30 hover:text-red-500 disabled:opacity-40"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      </svg>
    </button>
  );
}
