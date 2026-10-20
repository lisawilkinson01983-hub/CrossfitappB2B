import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/Avatar";
import { SectionCard } from "@/components/SectionCard";
import { SearchFilters } from "@/components/SearchFilters";
import { distanceMiles, ensureUserAreaCoords, ensureEventCoords, DISTANCE_RANGES } from "@/lib/geocode";
import { eventVisibilityWhere } from "@/lib/eventVisibility";
import { formatEventDate } from "@/lib/eventDate";
import { formatDateTime } from "@/lib/dates";
import {
  TEAMMATE_DIVISION_LABELS,
  TEAMMATE_GENDER_LABELS,
  formatTeammateRequest,
  parseTeammateRequests,
} from "@/lib/labels";
import { TEAMMATE_DIVISIONS, TEAMMATE_GENDERS, type TeammateDivisionOption, type TeammateGenderOption } from "@/lib/validation";
import { DiscoverTabs } from "@/components/DiscoverTabs";

export type TeammateSearchParams = {
  division?: string;
  gender?: string;
  distance?: string;
};

export async function TeammatesSearch({
  sp,
  currentUserId,
}: {
  sp: TeammateSearchParams;
  currentUserId: string;
}) {
  const division = TEAMMATE_DIVISIONS.find((d) => d === sp.division);
  const gender = TEAMMATE_GENDERS.find((g) => g === sp.gender);
  const distance = DISTANCE_RANGES.find((d) => String(d) === sp.distance);
  const activeFilterCount = [division, gender, distance].filter(Boolean).length;

  const now = new Date();
  // Same "effective end" rule as every other event listing — a multi-day
  // event stays open until its last day, not just its start.
  const notPastFilter = [{ endDate: null, date: { gte: now } }, { endDate: { gte: now } }];

  const [notices, currentUser] = await Promise.all([
    prisma.eventNotice.findMany({
      where: {
        // Null for a plain free-text notice — only ones carrying a structured
        // ask belong on this board (see EventNotice.teammateRequests).
        teammateRequests: { not: null },
        event: { AND: [eventVisibilityWhere(currentUserId), { OR: notPastFilter }] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        event: {
          select: { id: true, name: true, date: true, endDate: true, isOnline: true, location: true, lat: true, lng: true },
        },
        user: { select: { id: true, name: true, photo: true, affiliateGym: true } },
      },
      take: 60,
    }),
    prisma.user.findUnique({
      where: { id: currentUserId },
      select: { area: true, areaLat: true, areaLng: true },
    }),
  ]);

  // The JSON-encoded column can't be queried by division/gender directly
  // (same reasoning as lookingFor elsewhere) — decode first, then filter in
  // memory over this already-small (open, upcoming, visible) candidate set.
  const parsed = notices.map((notice) => ({
    notice,
    requests: parseTeammateRequests(notice.teammateRequests),
  }));

  const matchesFilters = (requests: { gender: TeammateGenderOption; division: TeammateDivisionOption }[]) =>
    requests.some(
      (r) => (!division || r.division === division || r.division === "ANY") && (!gender || r.gender === gender || r.gender === "ANY")
    );

  const filteredByRequest = parsed.filter(({ requests }) => !division && !gender ? true : matchesFilters(requests));

  const myCoords = currentUser ? await ensureUserAreaCoords({ id: currentUserId, ...currentUser }, { background: true }) : null;

  const withDistance = await Promise.all(
    filteredByRequest.map(async ({ notice, requests }) => {
      const coords = myCoords ? await ensureEventCoords(notice.event, { background: true }) : null;
      const miles = coords && myCoords ? distanceMiles(myCoords, coords) : null;
      return { notice, requests, miles };
    })
  );

  const visible = distance ? withDistance.filter(({ miles }) => miles !== null && miles <= distance) : withDistance;

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="border-b border-gray-200 pb-0.5">
        <DiscoverTabs active="teammates" />
      </div>
      <SectionCard>
        <form method="GET" className="flex flex-col gap-4">
          <input type="hidden" name="view" value="teammates" />
          <p className="text-sm text-b2b-ink/60">
            Open requests across every event — not just the ones you're already in.
          </p>
          <SearchFilters activeCount={activeFilterCount} defaultOpen={activeFilterCount > 0}>
            <div>
              <label htmlFor="division" className="block text-sm font-medium">
                Division
              </label>
              <select
                id="division"
                name="division"
                defaultValue={division ?? ""}
                className="mt-1 w-full max-w-xs rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
              >
                <option value="">Any division</option>
                {TEAMMATE_DIVISIONS.filter((d) => d !== "ANY").map((d) => (
                  <option key={d} value={d}>
                    {TEAMMATE_DIVISION_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="gender" className="block text-sm font-medium">
                Gender
              </label>
              <select
                id="gender"
                name="gender"
                defaultValue={gender ?? ""}
                className="mt-1 w-full max-w-xs rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
              >
                <option value="">Any gender</option>
                {TEAMMATE_GENDERS.filter((g) => g !== "ANY").map((g) => (
                  <option key={g} value={g}>
                    {TEAMMATE_GENDER_LABELS[g]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="distance" className="block text-sm font-medium">
                Distance
              </label>
              <select
                id="distance"
                name="distance"
                defaultValue={distance ? String(distance) : ""}
                disabled={!myCoords}
                className="mt-1 w-full max-w-xs rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none disabled:opacity-50"
              >
                <option value="">Any distance</option>
                {DISTANCE_RANGES.map((d) => (
                  <option key={d} value={d}>
                    Within {d} miles
                  </option>
                ))}
              </select>
              {!myCoords && (
                <p className="mt-1 text-xs text-b2b-ink/40">Set your area on your profile to filter by distance.</p>
              )}
            </div>
          </SearchFilters>
          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark"
            >
              Search
            </button>
            {activeFilterCount > 0 && (
              <a href="/discover?view=teammates" className="self-center text-sm text-b2b-ink/50 hover:underline">
                Clear filters
              </a>
            )}
          </div>
        </form>
      </SectionCard>

      {visible.length === 0 ? (
        <p className="text-b2b-ink/50">No open teammate requests match those filters right now.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map(({ notice, requests, miles }) => (
            <div key={notice.id} className="rounded-xl border border-b2b-purple/10 bg-b2b-card p-4">
              <div className="flex items-center gap-2 text-sm text-b2b-ink/60">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5 shrink-0">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M3 10h18M8 3v4M16 3v4" />
                </svg>
                <Link href={`/events/${notice.event.id}`} className="font-semibold text-b2b-ink hover:underline">
                  {notice.event.name}
                </Link>
                <span>·</span>
                <span>{formatEventDate(notice.event)}</span>
                {miles !== null && <span>· {miles < 1 ? "<1" : Math.round(miles)} miles away</span>}
              </div>

              <div className="mt-3 flex items-center gap-2.5">
                <Link href={`/profile/${notice.user.id}`}>
                  <Avatar photo={notice.user.photo} name={notice.user.name} size={32} />
                </Link>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    <Link href={`/profile/${notice.user.id}`} className="hover:underline">
                      {notice.user.name}
                    </Link>
                    {notice.user.affiliateGym && (
                      <span className="font-normal text-b2b-ink/50"> · {notice.user.affiliateGym}</span>
                    )}
                  </p>
                  <p className="text-xs text-b2b-ink/40">Posted {formatDateTime(notice.createdAt)}</p>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {requests.map((r, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-b2b-pink/10 px-2.5 py-1 text-xs font-medium text-b2b-pink-dark"
                  >
                    {formatTeammateRequest(r.quantity, r.gender, r.division)}
                  </span>
                ))}
              </div>

              {notice.text && <p className="mt-2.5 text-sm text-b2b-ink/80">{notice.text}</p>}

              <Link
                href={`/events/${notice.event.id}/notices#notice-${notice.id}`}
                className="mt-3 inline-block rounded-full bg-b2b-pink px-4 py-1.5 text-xs font-semibold text-white hover:bg-b2b-pink-dark"
              >
                Reply in Message Board
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
