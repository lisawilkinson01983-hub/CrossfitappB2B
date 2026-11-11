import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EventEngagementButtons } from "@/components/EventEngagementButtons";
import { SectionCard } from "@/components/SectionCard";
import { Avatar } from "@/components/Avatar";
import { distanceMiles, ensureUserAreaCoords, ensureEventCoords, DISTANCE_RANGES } from "@/lib/geocode";
import { formatEventDate } from "@/lib/eventDate";
import { SearchSuggestInput } from "@/components/SearchSuggestInput";
import { SearchFilters } from "@/components/SearchFilters";
import { CollapsibleSearch } from "@/components/CollapsibleSearch";
import { DiscoverTabs } from "@/components/DiscoverTabs";
import { eventVisibilityWhere } from "@/lib/eventVisibility";
import {
  isCompetitionEvent,
  EVENT_TEAM_FORMAT_LABELS,
  EVENT_GENDER_CATEGORY_LABELS,
  EVENT_DIVISION_LABELS,
} from "@/lib/labels";
import { EVENT_TEAM_FORMATS, EVENT_GENDER_CATEGORIES, EVENT_DIVISIONS } from "@/lib/validation";
import { EditIcon } from "@/components/EditIcon";
import { SwipeCardList, type SwipeCardItem } from "@/components/SwipeCardList";
import { ListOrCarousel } from "@/components/ListOrCarousel";
import { DiscoverMapLoader } from "@/components/DiscoverMapLoader";
import type { MapMarker } from "@/components/DiscoverMap";

const TIME_RANGES = {
  week: { label: "Next 7 days", days: 7 },
  month: { label: "Next 30 days", days: 30 },
  year: { label: "This year", days: 365 },
} as const;
type TimeRange = keyof typeof TIME_RANGES;

// "NA" (not applicable) is each field's own opt-out, not a real filter
// value — nobody's searching Discover for "events with no team format set".
const FILTERABLE_TEAM_FORMATS = EVENT_TEAM_FORMATS.filter((f) => f !== "NA");
const FILTERABLE_GENDER_CATEGORIES = EVENT_GENDER_CATEGORIES.filter((g) => g !== "NA");
const FILTERABLE_DIVISIONS = EVENT_DIVISIONS.filter((d) => d !== "NA");

const SORT_OPTIONS = {
  date: "Date (soonest first)",
  distance: "Distance (nearest first)",
} as const;
type SortOption = keyof typeof SORT_OPTIONS;

export type EventSearchParams = {
  q?: string;
  time?: string;
  distance?: string;
  type?: string;
  gender?: string;
  ability?: string;
  sort?: string;
};

export async function EventsList({
  sp,
  currentUserId,
}: {
  sp: EventSearchParams;
  currentUserId: string;
}) {
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const time = (Object.keys(TIME_RANGES) as TimeRange[]).find((t) => t === sp.time);
  const distance = DISTANCE_RANGES.find((d) => String(d) === sp.distance);
  const eventType = FILTERABLE_TEAM_FORMATS.find((t) => t === sp.type);
  const gender = FILTERABLE_GENDER_CATEGORIES.find((g) => g === sp.gender);
  const ability = FILTERABLE_DIVISIONS.find((d) => d === sp.ability);
  const sort: SortOption = sp.sort === "distance" ? "distance" : "date";
  const activeFilterCount = [distance, time, eventType, gender, ability].filter(Boolean).length;

  const now = new Date();
  // An event's "effective end" is endDate if it has one, otherwise date — so
  // a multi-day event stays listed until its last day, not just its start.
  const notPastFilter: Prisma.EventWhereInput["OR"] = [
    { endDate: null, date: { gte: now } },
    { endDate: { gte: now } },
  ];

  const where: Prisma.EventWhereInput = {
    AND: [
      eventVisibilityWhere(currentUserId),
      { OR: notPastFilter },
      ...(q ? [{ OR: [{ name: { contains: q } }, { location: { contains: q } }] }] : []),
      ...(time ? [{ date: { lte: new Date(Date.now() + TIME_RANGES[time].days * 86400000) } }] : []),
      // teamFormat/genderCategory/division are JSON-encoded arrays stored as
      // plain strings (e.g. `["TEAMS","PAIRS"]`) — matching the quoted token
      // rather than a bare substring keeps "MALE" from matching inside
      // "FEMALE".
      ...(eventType ? [{ teamFormat: { contains: `"${eventType}"` } }] : []),
      ...(gender ? [{ genderCategory: { contains: `"${gender}"` } }] : []),
      ...(ability ? [{ division: { contains: `"${ability}"` } }] : []),
    ],
  };

  const [events, currentUser, pendingCount] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { date: "asc" },
      include: {
        participants: { select: { userId: true } },
        interests: { select: { userId: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: currentUserId },
      select: { area: true, areaLat: true, areaLng: true, isAdmin: true },
    }),
    prisma.event.count({ where: { status: "PENDING" } }),
  ]);

  const myCoords = currentUser
    ? await ensureUserAreaCoords({ id: currentUserId, ...currentUser }, { background: true })
    : null;

  const eventsWithDistance = await Promise.all(
    events.map(async (event) => {
      const coords = myCoords ? await ensureEventCoords(event, { background: true }) : null;
      const miles = coords && myCoords ? distanceMiles(myCoords, coords) : null;
      return { event, miles };
    }),
  );

  const filteredEvents = distance
    ? eventsWithDistance.filter(({ miles }) => miles !== null && miles <= distance)
    : eventsWithDistance;

  // The DB query already sorts by date — only re-sort when distance is
  // explicitly chosen (and only possible once coords exist at all).
  const visibleEvents =
    sort === "distance" && myCoords
      ? [...filteredEvents].sort((a, b) => (a.miles ?? Infinity) - (b.miles ?? Infinity))
      : filteredEvents;

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href="/events/submit"
          className="rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark"
        >
          Create Event
        </Link>
        {currentUser?.isAdmin && (
          <Link href="/events/review" className="text-sm text-b2b-purple underline">
            Review submissions{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200 pb-0.5">
        <DiscoverTabs active="events" />
        <CollapsibleSearch label="Search events by name or area" defaultOpen={!!q || activeFilterCount > 0} variant="icon">
        <SectionCard>
        <form method="GET" className="flex flex-col gap-4">
          <input type="hidden" name="view" value="events" />
          <div>
            <label htmlFor="q" className="sr-only">
              Search events by name or area
            </label>
            <SearchSuggestInput
              kind="event"
              id="q"
              name="q"
              placeholder="Search events by name or area"
              defaultValue={q}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
            />
          </div>
          <SearchFilters activeCount={activeFilterCount} defaultOpen={activeFilterCount > 0}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="distance" className="block text-sm font-medium">
                  Distance
                </label>
                <select
                  id="distance"
                  name="distance"
                  defaultValue={distance ? String(distance) : ""}
                  disabled={!myCoords}
                  className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none disabled:opacity-50"
                >
                  <option value="">Any distance</option>
                  {DISTANCE_RANGES.map((d) => (
                    <option key={d} value={d}>
                      Within {d} miles
                    </option>
                  ))}
                </select>
                {!myCoords && (
                  <p className="mt-1 text-xs text-b2b-ink/40">
                    Set your area on your profile to filter events by distance.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="time" className="block text-sm font-medium">
                  When
                </label>
                <select
                  id="time"
                  name="time"
                  defaultValue={time ?? ""}
                  className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
                >
                  <option value="">Any time</option>
                  {(Object.keys(TIME_RANGES) as TimeRange[]).map((t) => (
                    <option key={t} value={t}>
                      {TIME_RANGES[t].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="type" className="block text-sm font-medium">
                  Type
                </label>
                <select
                  id="type"
                  name="type"
                  defaultValue={eventType ?? ""}
                  className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
                >
                  <option value="">Any type</option>
                  {FILTERABLE_TEAM_FORMATS.map((t) => (
                    <option key={t} value={t}>
                      {EVENT_TEAM_FORMAT_LABELS[t]}
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
                  className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
                >
                  <option value="">Any gender</option>
                  {FILTERABLE_GENDER_CATEGORIES.map((g) => (
                    <option key={g} value={g}>
                      {EVENT_GENDER_CATEGORY_LABELS[g]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ability" className="block text-sm font-medium">
                  Ability
                </label>
                <select
                  id="ability"
                  name="ability"
                  defaultValue={ability ?? ""}
                  className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
                >
                  <option value="">Any ability</option>
                  {FILTERABLE_DIVISIONS.map((d) => (
                    <option key={d} value={d}>
                      {EVENT_DIVISION_LABELS[d]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sort" className="block text-sm font-medium">
                  Sort by
                </label>
                <select
                  id="sort"
                  name="sort"
                  defaultValue={sort}
                  className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
                >
                  {(Object.keys(SORT_OPTIONS) as SortOption[]).map((s) => (
                    <option key={s} value={s} disabled={s === "distance" && !myCoords}>
                      {SORT_OPTIONS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </SearchFilters>
          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark"
            >
              Search
            </button>
            <a
              href="/discover?view=events"
              className="self-center text-sm text-b2b-ink/50 hover:underline"
            >
              Clear filters
            </a>
          </div>
        </form>

        <p className="mt-4 text-sm text-b2b-ink/50">
          Can't find an event? Click "Create Event" to add it to the listings (subject to review). Please
          check the event hasn't already been created to avoid duplication.
        </p>
      </SectionCard>
      </CollapsibleSearch>
      </div>

      {visibleEvents.length === 0 ? (
        <p className="text-b2b-ink/50">No events match those filters.</p>
      ) : (
        (() => {
          const eventMarkers: MapMarker[] = visibleEvents
            .filter(({ event }) => event.lat !== null && event.lng !== null)
            .map(({ event, miles }) => ({
              id: event.id,
              lat: event.lat as number,
              lng: event.lng as number,
              title: event.name,
              subtitle: [
                formatEventDate(event),
                event.isOnline ? "Online" : event.location,
                miles !== null ? `${miles < 1 ? "<1" : Math.round(miles)} miles away` : null,
              ]
                .filter(Boolean)
                .join(" · "),
              href: `/events/${event.id}`,
            }));

          const items: SwipeCardItem[] = visibleEvents.map(({ event, miles }) => {
            const isParticipating = event.participants.some((p) => p.userId === currentUserId);
            const isInterested = event.interests.some((i) => i.userId === currentUserId);
            return {
              id: event.id,
              image: event.photo,
              initial: event.name.charAt(0),
              title: event.name,
              badges: event.tag ? [event.tag] : [],
              subtitle: [
                formatEventDate(event),
                event.isOnline ? "Online" : event.location,
                miles !== null ? `${miles < 1 ? "<1" : Math.round(miles)} miles away` : null,
              ]
                .filter(Boolean)
                .join(" · "),
              href: `/events/${event.id}`,
              action: (
                <EventEngagementButtons
                  eventId={event.id}
                  initialParticipating={isParticipating}
                  initialInterested={isInterested}
                  isCompetition={isCompetitionEvent(event)}
                />
              ),
              cornerAction: currentUser?.isAdmin ? (
                <Link
                  href={`/events/${event.id}/edit`}
                  aria-label="Edit"
                  className="block text-white hover:text-b2b-pink"
                >
                  <EditIcon className="h-4 w-4" />
                </Link>
              ) : undefined,
            };
          });

          return (
            <ListOrCarousel
              label={`${visibleEvents.length} ${visibleEvents.length === 1 ? "event" : "events"}`}
              carousel={<SwipeCardList items={items} emptyMessage="No events match those filters." hideHeader />}
              map={
                <DiscoverMapLoader
                  markers={eventMarkers}
                  myCoords={myCoords}
                  emptyMessage="None of these events have a mapped location yet."
                />
              }
              list={
                <div className="flex flex-col gap-3">
                  {visibleEvents.map(({ event, miles }) => {
                    const isParticipating = event.participants.some((p) => p.userId === currentUserId);
                    const isInterested = event.interests.some((i) => i.userId === currentUserId);
                    return (
                      <div key={event.id} className="rounded-xl border border-b2b-purple/10 bg-b2b-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Avatar photo={event.photo} name={event.name} size={48} />
                            <div>
                              <p className="font-semibold">
                                <Link href={`/events/${event.id}`} className="hover:underline">
                                  {event.name}
                                </Link>
                                {event.tag && (
                                  <span className="ml-2 rounded-full bg-b2b-purple/10 px-2 py-0.5 text-xs text-b2b-purple">
                                    {event.tag}
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-b2b-ink/50">
                                {formatEventDate(event)} · {event.isOnline ? "Online" : event.location}
                                {miles !== null && <> · {miles < 1 ? "<1" : Math.round(miles)} miles away</>}
                              </p>
                            </div>
                          </div>
                          {currentUser?.isAdmin && (
                            <Link
                              href={`/events/${event.id}/edit`}
                              aria-label="Edit"
                              className="shrink-0 text-b2b-purple hover:text-b2b-purple-dark"
                            >
                              <EditIcon className="h-4 w-4" />
                            </Link>
                          )}
                        </div>
                        {event.description && (
                          <p className="mt-2 line-clamp-2 text-sm text-b2b-ink/70">{event.description}</p>
                        )}
                        <p className="mt-2 text-xs text-b2b-ink/40">
                          {event.participants.length}{" "}
                          {event.participants.length === 1 ? "athlete" : "athletes"} participating
                        </p>
                        <div className="mt-3">
                          <EventEngagementButtons
                            eventId={event.id}
                            initialParticipating={isParticipating}
                            initialInterested={isInterested}
                            isCompetition={isCompetitionEvent(event)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              }
            />
          );
        })()
      )}
    </div>
  );
}
