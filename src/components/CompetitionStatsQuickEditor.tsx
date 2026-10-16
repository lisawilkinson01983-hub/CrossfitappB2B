"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CompetitionStatsEditor,
  communityCupResultRowsToPayload,
  openResultRowsToPayload,
  type CommunityCupResultRow,
  type OpenResultRow,
} from "@/components/CompetitionStatsEditor";

export type CompetitionStatsQuickEditorInitial = {
  openResults: OpenResultRow[];
  communityCupResults: CommunityCupResultRow[];
};

/** A save-button wrapper around CompetitionStatsEditor — used inline on the profile page's "Competition stats" card, mirroring PbEditor's "Key PBs" pattern. */
export function CompetitionStatsQuickEditor({
  initial,
  onSaved,
}: {
  initial: CompetitionStatsQuickEditorInitial;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [openResults, setOpenResults] = useState<OpenResultRow[]>(initial.openResults);
  const [communityCupResults, setCommunityCupResults] = useState<CommunityCupResultRow[]>(initial.communityCupResults);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/profile/competition-stats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        openResults: openResultRowsToPayload(openResults),
        communityCupResults: communityCupResultRowsToPayload(communityCupResults),
      }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.refresh();
    onSaved();
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <CompetitionStatsEditor
        openResults={openResults}
        onOpenResultsChange={setOpenResults}
        communityCupResults={communityCupResults}
        onCommunityCupResultsChange={setCommunityCupResults}
      />
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting}
          className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onSaved} className="text-sm text-b2b-ink/50 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
