"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Shown only on a solo result flagged as conflicting with a place the
 * viewer's own team holds (see the results page's conflictingTeamName
 * check) — lets the team's creator clear up a teammate's leftover
 * individual claim, e.g. logged before they were added to the team.
 * Server-side this only allows deleting a solo result (no teamId) sitting
 * at the exact place a team the caller created holds — never any other
 * result (see DELETE /api/event-results/[id]).
 */
export function CaptainRemoveDuplicateButton({
  resultId,
  personName,
  teamName,
}: {
  resultId: string;
  personName: string;
  teamName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (
          !confirm(
            `Remove ${personName}'s individual result?\n\nThey'll stay on ${teamName}'s result. They'll get a notification that you removed their separate solo entry.`
          )
        )
          return;
        setBusy(true);
        await fetch(`/api/event-results/${resultId}`, { method: "DELETE" }).catch(() => {});
        router.refresh();
      }}
      className="mt-2 w-full rounded-lg border border-red-400 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-red-600 disabled:opacity-40"
    >
      Remove duplicate claim
    </button>
  );
}
