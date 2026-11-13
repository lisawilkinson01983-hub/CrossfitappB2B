"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ShareResultButton } from "@/components/ShareResultButton";
import { placeMedal } from "@/lib/eventResults";

type Member = { id: string; name: string; photo: string | null };

/**
 * One ranked row on a team-format event's Results page — tapping it opens a
 * read-only roster popout (same visual language as TeamRosterTrigger's
 * modal, but without any of its invite/rename/remove controls, since this
 * is just "who's on this team", not team management).
 */
export function TeamResultRow({
  rank,
  teamName,
  members,
  pendingMembers = [],
  placementLabel,
  resultHeadline,
  resultId,
}: {
  rank: number;
  teamName: string;
  members: Member[];
  /** Invited but not yet accepted — shown in the roster popout greyed out so the team's full intended lineup is visible even before everyone's confirmed, not just whoever's officially joined so far. */
  pendingMembers?: Member[];
  placementLabel: string;
  resultHeadline: string;
  /** Any one of the team's own per-member EventResult rows (they all carry the same placement) — see ShareResultButton. */
  resultId: string;
}) {
  const [open, setOpen] = useState(false);
  const medal = placeMedal(rank <= 3 ? rank : null);

  return (
    <>
      <div
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${
          rank === 1 ? "border border-b2b-pink/35 bg-b2b-pink/10" : "bg-b2b-card"
        }`}
      >
        <button type="button" onClick={() => setOpen(true)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <span className={`w-6 text-center font-display text-xl ${rank === 1 ? "text-b2b-pink-dark" : "text-b2b-ink/40"}`}>
            {rank}
          </span>
          <div className="flex shrink-0">
            {members.slice(0, 3).map((m, i) => (
              <div key={m.id} className={i > 0 ? "-ml-2.5 rounded-full ring-2 ring-b2b-card" : "rounded-full"}>
                <Avatar photo={m.photo} name={m.name} size={28} />
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm ${rank === 1 ? "font-extrabold text-b2b-ink" : "font-bold text-b2b-ink"}`}>{teamName}</p>
            <p className="text-[10.5px] text-b2b-ink/45">
              {members.length} {members.length === 1 ? "athlete" : "athletes"}
              {pendingMembers.length > 0 && ` · ${pendingMembers.length} pending`}
            </p>
          </div>
          {medal && <span className="text-sm">{medal}</span>}
          <span className="text-xs text-b2b-ink/30">›</span>
        </button>
        <ShareResultButton resultId={resultId} />
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-xs rounded-2xl bg-b2b-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-xl leading-none text-b2b-ink">{teamName.toUpperCase()}</p>
                <p className="mt-1.5 text-xs text-b2b-ink/50">
                  {medal ?? "🏆"} {resultHeadline} · {placementLabel}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-b2b-ink/30">
                ✕
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <Avatar photo={m.photo} name={m.name} size={34} />
                  <p className="text-sm font-semibold text-b2b-ink">{m.name}</p>
                </div>
              ))}
              {pendingMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5 opacity-40">
                  <Avatar photo={m.photo} name={m.name} size={34} />
                  <p className="text-sm font-semibold text-b2b-ink">{m.name}</p>
                  <span className="rounded-full border border-b2b-ink/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-b2b-ink/50">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
