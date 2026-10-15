"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

function tabClass(active: boolean) {
  return `shrink-0 whitespace-nowrap pb-2.5 text-xs font-bold border-b-2 ${
    active ? "border-b2b-pink text-b2b-ink" : "border-transparent text-b2b-ink/45 hover:text-b2b-ink/70"
  }`;
}

/**
 * The event page's Overview/Workouts tab row, plus Find a Team/Message
 * Board alongside them as plain navigation (those are full pages of their
 * own, not content that lives here) — replaces the old stack of same-weight
 * buttons with one row, Overview and Workouts switching in place.
 */
export function EventTabs({
  overview,
  workouts,
  findTeamHref,
  noticesHref,
  noticesCount,
}: {
  overview: ReactNode;
  workouts: ReactNode;
  /** Omitted for a private social event — there's no "team" to find. */
  findTeamHref: string | null;
  noticesHref: string;
  noticesCount: number;
}) {
  const [tab, setTab] = useState<"overview" | "workouts">("overview");

  return (
    <div>
      <div className="flex gap-4 overflow-x-auto border-b border-b2b-purple/15">
        <button type="button" onClick={() => setTab("overview")} className={tabClass(tab === "overview")}>
          Overview
        </button>
        <button type="button" onClick={() => setTab("workouts")} className={tabClass(tab === "workouts")}>
          Workouts
        </button>
        {findTeamHref && (
          <Link href={findTeamHref} className={tabClass(false)}>
            Find a Team
          </Link>
        )}
        <Link href={noticesHref} className={`${tabClass(false)} flex items-center gap-1.5`}>
          Message board
          {noticesCount > 0 && (
            <span className="flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-b2b-pink px-1 text-[9px] font-bold text-white">
              {noticesCount}
            </span>
          )}
        </Link>
      </div>

      <div className="mt-4">{tab === "overview" ? overview : workouts}</div>
    </div>
  );
}
