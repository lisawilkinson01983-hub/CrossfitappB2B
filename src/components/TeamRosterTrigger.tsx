"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";

type RosterMember = { id: string; name: string; photo: string | null };

/**
 * Wraps a team's avatar-stack/member-list summary (passed as `children`,
 * since that line is truncated to fit the card and can hide members once a
 * roster gets long) — tapping it opens the full, untruncated list in a
 * popout, same modal pattern as TeamTagPrompt. Used on both an event's own
 * Teams page and My Teams.
 */
export function TeamRosterTrigger({
  teamName,
  eventName,
  members,
  freeformNames,
  children,
}: {
  teamName: string;
  eventName?: string;
  members: RosterMember[];
  freeformNames: string[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const total = members.length + freeformNames.length;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="w-full text-left">
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-xl bg-b2b-card p-5 shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-b2b-ink">{teamName}</p>
                {eventName && <p className="truncate text-xs text-b2b-ink/50">{eventName}</p>}
                <p className="mt-0.5 text-xs text-b2b-ink/40">
                  {total} {total === 1 ? "participant" : "participants"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 rounded px-1 text-lg leading-none text-b2b-ink/40 hover:text-b2b-ink"
              >
                ×
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {members.map((m) => (
                <Link
                  key={m.id}
                  href={`/profile/${m.id}`}
                  className="flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-b2b-bg"
                >
                  <Avatar photo={m.photo} name={m.name} size={32} />
                  <span className="truncate text-sm font-medium text-b2b-ink">{m.name}</span>
                </Link>
              ))}
              {freeformNames.map((name) => (
                <div key={name} className="flex items-center gap-2.5 px-1 py-1">
                  <Avatar photo={null} name={name} size={32} />
                  <span className="truncate text-sm text-b2b-ink/70">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
