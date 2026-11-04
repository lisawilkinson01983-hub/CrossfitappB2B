"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
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
  placementLabel,
  resultHeadline,
}: {
  rank: number;
  teamName: string;
  members: Member[];
  placementLabel: string;
  resultHeadline: string;
}) {
  const [open, setOpen] = useState(false);
  const medal = placeMedal(rank <= 3 ? rank : null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left ${
          rank === 1 ? "border border-b2b-pink/35 bg-b2b-pink/10" : "bg-b2b-card"
        }`}
      >
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
          </p>
        </div>
        {medal && <span className="text-sm">{medal}</span>}
        <span className="text-xs text-b2b-ink/30">›</span>
      </button>

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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
