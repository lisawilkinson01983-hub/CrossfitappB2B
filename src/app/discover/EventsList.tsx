import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ParticipateButton } from "@/components/ParticipateButton";
import { SectionCard } from "@/components/SectionCard";
import { Avatar } from "@/components/Avatar";
import { geocode, distanceMiles, ensureUserAreaCoords, DISTANCE_RANGES } from "@/lib/geocode";

const TIME_RANGES = {
  week: { label: "Next 7 days", days: 7 },
  month: { label: "Next 30 days", days: 30 },
  year: { label: "This year", days: 365 },
} as const;
type TimeRange = keyof typeof TIME_RANGES;

export type EventSearchParams = {
  q?: string;
  time?: string;
  distance?: string;
};

// Events are added directly to the database (no in-app creation form), so
// they may not have been geocoded yet — do it lazily on first read and cache
// the result on the row.
async function ensureEventCoords(event: { id: string; location: string; lat: number | null; lng: number | null }) {
  if (event.lat !== null && event.lng !== null) return { lat: event.lat, lng: event.lng };

  const coords = await geocode(event.location);
  if (!coords) return null;

  await prisma.event.update({
    where: { id: event.id },
    data: { lat: coords.lat, lng: coords.lng },
  });
  return coords;
}

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

  const where: Prisma.EventWhereInput = {
    ...(q ? { OR: [{ name: { contains: q } }, { location: { contains: q } }] } : {}),
    ...(time ? { date: { lte: new Date(Date.now() + TIME_RANGES[time].days * 86400000) } } : {}),
  };

  const [events, currentUser] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { date: "asc" },
      include: { participants: { select: { userId: true } } },
    }),
    prisma.user.findUnique({
      where: { id: currentUserId },
      select: { area: true, areaLat: true, areaLng: true },
    }),
  ]);

  const myCoords = currentUser
    ? await ensureUserAreaCoords({ id: currentUserId, ...currentUser })
    : null;

  const eventsWithDistance = await Promise.all(
    events.map(async (event) => {
      const coords = myCoords ? await ensureEventCoords(event) : null;
      const miles = coords && myCoords ? distanceMiles(myCoords, coords) : null;
      return { event, miles };
    }),
  );

  const visibleEvents = distance
    ? eventsWithDistance.filter(({ miles }) => miles !== null && miles <= distance)
    : eventsWithDistance;

  return (
    <div className="mt-4 flex flex-col gap-6">
      <SectionCard>
        <form method="GET" className="flex flex-col gap-4">
          <input type="hidden" name="view" value="events" />
          <div>
            <label htmlFor="q" className="sr-only">
              Search events by name or area
            </label>
            <input
              id="q"
              name="q"
              type="text"
              placeholder="Search events by name or area"
              defaultValue={q}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
            />
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
              className="mt-1 w-full max-w-xs rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none"
            >
              <option value="">Any time</option>
              {(Object.keys(TIME_RANGES) as TimeRange[]).map((t) => (
                <option key={t} value={t}>
                  {TIME_RANGES[t].label}
                </option>
              ))}
            </select>
          </div>
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
      </SectionCard>

      {visibleEvents.length === 0 ? (
        <p className="text-b2b-ink/50">No events match those filters.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleEvents.map(({ event, miles }) => {
            const isParticipating = event.participants.some((p) => p.userId === currentUserId);
            return (
              <div key={event.id} className="rounded-xl border border-b2b-purple/10 bg-b2b-card p-4">
                <div className="flex items-start justify-between gap-4">
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
                        {event.date.toLocaleDateString(undefined, {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        · {event.location}
                        {miles !== null && <> · {miles < 1 ? "<1" : Math.round(miles)} miles away</>}
                      </p>
                    </div>
                  </div>
                  <ParticipateButton eventId={event.id} initialParticipating={isParticipating} />
                </div>
                {event.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-b2b-ink/70">{event.description}</p>
                )}
                <p className="mt-2 text-xs text-b2b-ink/40">
                  {event.participants.length}{" "}
                  {event.participants.length === 1 ? "athlete" : "athletes"} participating
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
