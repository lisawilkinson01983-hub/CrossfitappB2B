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
  LEVEL_LABELS,
  formatTeammateRequest,
  parseTeammateRequests,
  parseLevels,
} from "@/lib/labels";
import { TEAMMATE_DIVISIONS, TEAMMATE_GENDERS, PB_FIELDS, type TeammateDivisionOption, type TeammateGenderOption, type PbField } from "@/lib/validation";
import { DiscoverTabs } from "@/components/DiscoverTabs";
import { scoreTeammateMatch, type MatchProfile, type MatchWorkout } from "@/lib/teammateMatchScore";
import { SuggestedTeammates, type SuggestedTeammate } from "@/components/SuggestedTeammates";
import type { FollowStatus } from "@/components/FollowButton";

const MAX_SUGGESTIONS = 6;
const workoutSelect = { wodName: true, unit: true, score: true, rounds: true, reps: true } as const;
const pbSelect = Object.fromEntries(PB_FIELDS.map((f) => [f, true])) as Record<PbField, true>;

const SORT_OPTIONS = {
  newest: "Newest posted",
  date: "Event date (soonest first)",
  distance: "Distance (nearest first)",
} as const;
type SortOption = keyof typeof SORT_OPTIONS;

export type TeammateSearchParams = {
  division?: string;
  gender?: string;
  distance?: string;
  sort?: string;
  event?: string;
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
  const sort: SortOption = sp.sort === "date" ? "date" : sp.sort === "distance" ? "distance" : "newest";
  const now = new Date();
  // Same "effective end" rule as every other event listing — a multi-day
  // event stays open until its last day, not just its start.
  const notPastFilter = [{ endDate: null, date: { gte: now } }, { endDate: { gte: now } }];

  const [notices, currentUser, candidateEvents] = await Promise.all([
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
      select: {
        id: true,
        area: true,
        areaLat: true,
        areaLng: true,
        levels: true,
        openLevel: true,
        workouts: { select: workoutSelect },
        ...pbSelect,
      },
    }),
    // The "narrow by event" options below — any event someone could
    // plausibly want to narrow their teammate suggestions to.
    prisma.event.findMany({
      where: { AND: [eventVisibilityWhere(currentUserId), { OR: notPastFilter }] },
      select: { id: true, name: true },
      orderBy: { date: "asc" },
      take: 200,
    }),
  ]);
  const selectedEvent = candidateEvents.find((e) => e.id === sp.event) ?? null;
  const activeFilterCount = [division, gender, distance, selectedEvent].filter(Boolean).length;

  // --- Suggested for you: the same ability/distance/PB match used on an
  // event's own find-a-teammate page (see scoreTeammateMatch, which needs
  // no event data of its own) — scored here against every athlete with
  // some competitive activity, or against one event's interested list once
  // narrowed. A Follow button rides along, since surfacing someone you'd
  // match well with is also exactly when you'd want to follow them.
  let suggestedTeammates: SuggestedTeammate[] = [];
  if (currentUser) {
    const myCoords = await ensureUserAreaCoords(currentUser, { background: true });
    const myProfile: MatchProfile & { coords: typeof myCoords; workouts: MatchWorkout[] } = {
      id: currentUser.id,
      levels: parseLevels(currentUser.levels),
      openLevel: currentUser.openLevel,
      pbs: Object.fromEntries(PB_FIELDS.map((f) => [f, currentUser[f]])) as Partial<Record<PbField, number | null>>,
      coords: myCoords,
      workouts: currentUser.workouts,
    };

    const candidateSelect = {
      id: true,
      name: true,
      photo: true,
      levels: true,
      openLevel: true,
      areaLat: true,
      areaLng: true,
      workouts: { select: workoutSelect },
      ...pbSelect,
    } as const;

    const candidates = selectedEvent
      ? (
          await prisma.eventInterest.findMany({
            where: { eventId: selectedEvent.id, userId: { not: currentUserId } },
            select: { user: { select: candidateSelect } },
          })
        ).map((i) => i.user)
      : await prisma.user.findMany({
          where: {
            id: { not: currentUserId },
            deletedAt: null,
            accountType: "ATHLETE",
            // Anyone with some competitive activity — not every registered
            // account, which would surface people who never engaged at all.
            OR: [{ eventInterests: { some: {} } }, { eventParticipations: { some: {} } }],
          },
          select: candidateSelect,
          take: 300,
        });

    suggestedTeammates = candidates
      .map((u) => {
        const candidateProfile: MatchProfile & { coords: Awaited<ReturnType<typeof ensureUserAreaCoords>>; workouts: MatchWorkout[] } = {
          id: u.id,
          levels: parseLevels(u.levels),
          openLevel: u.openLevel,
          pbs: Object.fromEntries(PB_FIELDS.map((f) => [f, u[f]])) as Partial<Record<PbField, number | null>>,
          coords: u.areaLat != null && u.areaLng != null ? { lat: u.areaLat, lng: u.areaLng } : null,
          workouts: u.workouts,
        };
        const { score, reasons } = scoreTeammateMatch(myProfile, candidateProfile);
        const levelLabels = candidateProfile.levels.map((l) => LEVEL_LABELS[l]);
        const subtitle =
          [levelLabels.join("/"), u.openLevel != null ? `Level ${u.openLevel}` : null].filter(Boolean).join(" · ") || null;
        return { id: u.id, name: u.name, photo: u.photo, score, subtitle, reasons };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SUGGESTIONS);

    if (suggestedTeammates.length > 0) {
      const ids = suggestedTeammates.map((s) => s.id);
      const [myFollows, myPending] = await Promise.all([
        prisma.follow.findMany({
          where: { followerId: currentUserId, followingId: { in: ids } },
          select: { followingId: true },
        }),
        prisma.followRequest.findMany({
          where: { requesterId: currentUserId, targetId: { in: ids }, status: "PENDING" },
          select: { targetId: true },
        }),
      ]);
      const followingIds = new Set(myFollows.map((f) => f.followingId));
      const pendingIds = new Set(myPending.map((r) => r.targetId));
      suggestedTeammates = suggestedTeammates.map((s) => ({
        ...s,
        followStatus: (followingIds.has(s.id) ? "following" : pendingIds.has(s.id) ? "pending" : "none") as FollowStatus,
      }));
    }
  }

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

  const myCoords = currentUser ? await ensureUserAreaCoords(currentUser, { background: true }) : null;

  const withDistance = await Promise.all(
    filteredByRequest.map(async ({ notice, requests }) => {
      const coords = myCoords ? await ensureEventCoords(notice.event, { background: true }) : null;
      const miles = coords && myCoords ? distanceMiles(myCoords, coords) : null;
      return { notice, requests, miles };
    })
  );

  const filtered = distance ? withDistance.filter(({ miles }) => miles !== null && miles <= distance) : withDistance;

  // The DB query already sorts newest-first — only re-sort for the other options.
  const visible =
    sort === "distance" && myCoords
      ? [...filtered].sort((a, b) => (a.miles ?? Infinity) - (b.miles ?? Infinity))
      : sort === "date"
        ? [...filtered].sort((a, b) => a.notice.event.date.getTime() - b.notice.event.date.getTime())
        : filtered;

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="border-b border-gray-200 pb-0.5">
        <DiscoverTabs active="teammates" />
      </div>

      {suggestedTeammates.length > 0 && (
        <SuggestedTeammates
          items={suggestedTeammates}
          heading={selectedEvent ? `Suggested for ${selectedEvent.name}` : "Suggested for you"}
          clearHref={selectedEvent ? "/discover?view=teammates" : undefined}
        />
      )}

      <SectionCard>
        <form method="GET" className="flex flex-col gap-4">
          <input type="hidden" name="view" value="teammates" />
          <p className="text-sm text-b2b-ink/60">
            Open requests across every event — not just the ones you're already in.
          </p>
          <SearchFilters activeCount={activeFilterCount} defaultOpen={activeFilterCount > 0}>
            <div>
              <label htmlFor="event" className="block text-sm font-medium">
                Event
              </label>
              <select
                id="event"
                name="event"
                defaultValue={selectedEvent?.id ?? ""}
                className="mt-1 w-full max-w-xs rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
              >
                <option value="">Any event</option>
                {candidateEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-b2b-ink/40">
                Narrows &ldquo;Suggested for you&rdquo; to people interested in that event.
              </p>
            </div>
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
            <div>
              <label htmlFor="sort" className="block text-sm font-medium">
                Sort by
              </label>
              <select
                id="sort"
                name="sort"
                defaultValue={sort}
                className="mt-1 w-full max-w-xs rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
              >
                {(Object.keys(SORT_OPTIONS) as SortOption[]).map((s) => (
                  <option key={s} value={s} disabled={s === "distance" && !myCoords}>
                    {SORT_OPTIONS[s]}
                  </option>
                ))}
              </select>
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
