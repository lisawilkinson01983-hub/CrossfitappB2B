"use client";

import { useState } from "react";
import {
  CompetitionStatsQuickEditor,
  type CompetitionStatsQuickEditorInitial,
} from "@/components/CompetitionStatsQuickEditor";

type OpenResultSummary = { id: string; year: number; division: string; overallRank: number | null; countryRank: number | null };
type CommunityCupResultSummary = { id: string; year: number; division: string; rank: number | null; competition: string | null };

function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** The "Competition stats" card's body — a read-only list, plus (for the profile's owner) an inline editor toggled in place, mirroring PbCardBody's "Key PBs" pattern. */
export function CompetitionStatsCardBody({
  openResults,
  communityCupResults,
  isOwner,
  editorInitial,
}: {
  openResults: OpenResultSummary[];
  communityCupResults: CommunityCupResultSummary[];
  isOwner: boolean;
  editorInitial: CompetitionStatsQuickEditorInitial;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <CompetitionStatsQuickEditor initial={editorInitial} onSaved={() => setEditing(false)} />;
  }

  const hasAny = openResults.length > 0 || communityCupResults.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {hasAny ? (
        <div className="flex flex-col gap-2">
          {openResults.map((r) => (
            <div key={r.id} className="rounded-lg border border-b2b-purple/10 bg-b2b-bg px-3 py-2">
              <p className="text-xs text-b2b-ink/50">
                {r.year} CrossFit Open · {r.division}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-b2b-ink">
                {[
                  r.overallRank != null && `${ordinal(r.overallRank)} overall`,
                  r.countryRank != null && `${ordinal(r.countryRank)} country`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </div>
          ))}
          {communityCupResults.map((r) => (
            <div key={r.id} className="rounded-lg border border-b2b-purple/10 bg-b2b-bg px-3 py-2">
              <p className="text-xs text-b2b-ink/50">
                {r.year} Community Cup · {r.division}
                {r.competition ? ` · ${r.competition}` : ""}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-b2b-ink">{r.rank != null ? ordinal(r.rank) : "—"}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-b2b-ink/40">Not set</p>
      )}
      {isOwner && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="self-start text-sm text-b2b-pink underline"
        >
          {hasAny ? "Edit competition stats" : "+ Add competition stats"}
        </button>
      )}
    </div>
  );
}
