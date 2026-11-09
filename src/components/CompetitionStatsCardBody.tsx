"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

/**
 * The dark banner treatment for the latest Open/Community Cup result —
 * visible to everyone unless hidden; the toggle itself only renders for the
 * profile's owner, same show/hide-for-the-owner-only pattern as everywhere
 * else a privacy control sits next to the data it controls.
 */
function FeaturedBanner({
  label,
  headline,
  subtext,
  hidden,
  isOwner,
  busy,
  onToggle,
}: {
  label: string;
  headline: string;
  subtext: string;
  hidden: boolean;
  isOwner: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  if (hidden && !isOwner) return null;

  return (
    <div className={`overflow-hidden rounded-xl border border-b2b-purple/10 ${hidden ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between bg-b2b-ink px-3.5 py-2">
        <p className="text-xs font-bold text-b2b-bg">🏆 {label}</p>
        {isOwner && (
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            aria-label={hidden ? `Show ${label.toLowerCase()} on profile` : `Hide ${label.toLowerCase()} from profile`}
            aria-pressed={!hidden}
            className="relative h-4 w-7 shrink-0 rounded-full disabled:opacity-50"
            style={{ backgroundColor: hidden ? "rgba(255,255,255,0.25)" : "var(--color-b2b-pink)" }}
          >
            <span
              className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all"
              style={{ left: hidden ? "2px" : "14px" }}
            />
          </button>
        )}
      </div>
      <div className="px-3.5 py-2.5">
        <p className="font-display text-xl leading-tight text-b2b-ink">{headline}</p>
        <p className="mt-0.5 text-xs text-b2b-ink/50">{subtext}</p>
      </div>
    </div>
  );
}

/** The "Competition stats" card's body — featured banners for the latest Open/Community Cup, the full year-by-year list, and (for the profile's owner) an inline editor toggled in place, mirroring PbCardBody's "Key PBs" pattern. */
export function CompetitionStatsCardBody({
  openResults,
  communityCupResults,
  isOwner,
  editorInitial,
  hideRecentOpen,
  hideRecentCommunityCup,
}: {
  openResults: OpenResultSummary[];
  communityCupResults: CommunityCupResultSummary[];
  isOwner: boolean;
  editorInitial: CompetitionStatsQuickEditorInitial;
  hideRecentOpen: boolean;
  hideRecentCommunityCup: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [hiddenOpen, setHiddenOpen] = useState(hideRecentOpen);
  const [hiddenCup, setHiddenCup] = useState(hideRecentCommunityCup);
  const [busyToggle, setBusyToggle] = useState<"open" | "cup" | null>(null);

  if (editing) {
    return <CompetitionStatsQuickEditor initial={editorInitial} onSaved={() => setEditing(false)} />;
  }

  const hasAny = openResults.length > 0 || communityCupResults.length > 0;
  // Already ordered by year desc (see ProfileDetails) — first row is the
  // most recent, no separate "featured" flag to maintain.
  const latestOpen = openResults[0];
  const latestCup = communityCupResults[0];

  async function toggleVisibility(field: "hideRecentOpen" | "hideRecentCommunityCup") {
    const key = field === "hideRecentOpen" ? "open" : "cup";
    const nextValue = field === "hideRecentOpen" ? !hiddenOpen : !hiddenCup;
    setBusyToggle(key);
    const res = await fetch("/api/profile/competition-stats/visibility", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: nextValue }),
    });
    setBusyToggle(null);
    if (res.ok) {
      if (field === "hideRecentOpen") setHiddenOpen(nextValue);
      else setHiddenCup(nextValue);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {latestOpen && (
        <FeaturedBanner
          label="Latest CrossFit Open"
          headline={
            [
              latestOpen.overallRank != null && `${ordinal(latestOpen.overallRank)} overall`,
              latestOpen.countryRank != null && `${ordinal(latestOpen.countryRank)} country`,
            ]
              .filter(Boolean)
              .join(" · ") || "—"
          }
          subtext={`${latestOpen.year} · ${latestOpen.division}`}
          hidden={hiddenOpen}
          isOwner={isOwner}
          busy={busyToggle === "open"}
          onToggle={() => toggleVisibility("hideRecentOpen")}
        />
      )}
      {latestCup && (
        <FeaturedBanner
          label="Latest Community Cup"
          headline={latestCup.rank != null ? ordinal(latestCup.rank) : "—"}
          subtext={[`${latestCup.year}`, latestCup.division, latestCup.competition].filter(Boolean).join(" · ")}
          hidden={hiddenCup}
          isOwner={isOwner}
          busy={busyToggle === "cup"}
          onToggle={() => toggleVisibility("hideRecentCommunityCup")}
        />
      )}

      {!hasAny && <p className="text-b2b-ink/40">Not set</p>}
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
