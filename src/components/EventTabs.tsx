import Link from "next/link";
import type { ReactNode } from "react";

function navItemClass(active: boolean) {
  return `flex-1 whitespace-nowrap rounded-[10px] px-2 py-2 text-center text-xs font-bold transition-colors ${
    active ? "bg-b2b-card text-b2b-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-b2b-ink/45 hover:text-b2b-ink/70"
  }`;
}

/**
 * The event page's Overview/Find a Team/Message Board row. Overview (the
 * only one with content living on this page, workouts included — see
 * EventWorkoutsList) is always the current section; the other two are
 * plain navigation to their own dedicated pages, styled into the same row
 * for a consistent "sections" feel rather than a stack of same-weight
 * buttons.
 */
export function EventTabs({
  overview,
  findTeamHref,
  noticesHref,
  noticesCount,
}: {
  overview: ReactNode;
  /** Omitted for a private social event — there's no "team" to find. */
  findTeamHref: string | null;
  noticesHref: string;
  noticesCount: number;
}) {
  return (
    <div>
      <div className="flex gap-1 rounded-[14px] bg-b2b-ink/[0.06] p-1">
        <span className={navItemClass(true)}>Overview</span>
        {findTeamHref && (
          <Link href={findTeamHref} className={navItemClass(false)}>
            Find a Team
          </Link>
        )}
        <Link href={noticesHref} className={`${navItemClass(false)} flex items-center justify-center gap-1.5`}>
          Message board
          {noticesCount > 0 && (
            <span className="flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-b2b-pink px-1 text-[9px] font-bold text-white">
              {noticesCount}
            </span>
          )}
        </Link>
      </div>

      <div className="mt-4">{overview}</div>
    </div>
  );
}
