import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { SectionOnboarding } from "@/components/SectionOnboarding";
import { Avatar } from "@/components/Avatar";
import { PinButton } from "@/components/PinButton";
import { EventEngagementButtons } from "@/components/EventEngagementButtons";
import { distanceMiles, ensureUserAreaCoords, ensureEventCoords, DISTANCE_RANGES } from "@/lib/geocode";

const TIME_RANGES = { week: { days: 7 }, month: { days: 30 }, year: { days: 365 } } as const;
type TimeRange = keyof typeof TIME_RANGES;

export default async function MyEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; time?: string; distance?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const sp = await searchParams;
  const tab = sp.tab === "past" ? "past" : "upcoming";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const time = (Object.keys(TIME_RANGES) as TimeRange[]).find((t) => t === sp.time);
  const distance = DISTANCE_RANGES.find((d) => String(d) === sp.distance);

  const now = new Date();
  const dateFilter: Prisma.EventWhereInput["date"] =
    tab === "past"
      ? { lt: now, ...(time ? { gte: new Date(now.getTime() - TIME_RANGES[time].days * 86400000) } : {}) }
      : { gte: now, ...(time ? { lte: new Date(now.getTime() + TIME_RANGES[time].days * 86400000) } : {}) };

  const where: Prisma.EventWhereInput = {
    OR: [{ participants: { some: { userId } } }, { interests: { some: { userId } } }],
    date: dateFilter,
    ...(q ? { AND: [{ OR: [{ name: { contains: q } }, { location: { contains: q } }] }] } : {}),
  };

  const [events, pins, currentUser] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { date: tab === "past" ? "desc" : "asc" },
      include: {
        participants: { select: { userId: true } },
        interests: { select: { userId: true } },
      },
    }),
    prisma.eventPin.findMany({ where: { userId }, select: { eventId: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { area: true, areaLat: true, areaLng: true, hasSeenEventsTour: true },
    }),
  ]);

  const pinnedIds = new Set(pins.map((p) => p.eventId));

  const myCoords = currentUser ? await ensureUserAreaCoords({ id: userId, ...currentUser }) : null;

  const eventsWithDistance = await Promise.all(
    events.map(async (event) => {
      const coords = myCoords ? await ensureEventCoords(event) : null;
      const miles = coords && myCoords ? distanceMiles(myCoords, coords) : null;
      return { event, miles, pinned: pinnedIds.has(event.id) };
    }),
  );

  const filtered = distance
    ? eventsWithDistance.filter(({ miles }) => miles !== null && miles <= distance)
    : eventsWithDistance;

  const visibleEvents = [...filtered].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      {!currentUser?.hasSeenEventsTour && (
        <SectionOnboarding
          section="events"
          finishLabel="Close"
          cards={[
            {
              emoji: "📅",
              title: "My Events",
              body: "Found an event? Tap Participate or Interested and it'll show up on your profile, so others can see what you've got coming up.",
            },
            {
              emoji: "🤝",
              title: "Find a Team",
              body: "Short a teammate, or a whole team? Post a notice on the event page to find one — or set an alert to get notified the moment someone matching your criteria posts. You can also chat with fellow competitors in that event's Notice Board.",
            },
          ]}
        />
      )}
      <NavBar />
      <h1 className="mt-6 text-2xl font-bold">My Events</h1>

      <div className="mt-4 flex gap-4 border-b border-gray-200 text-sm font-medium">
        <Link
          href="/events/mine?tab=upcoming"
          className={`pb-2 ${tab === "upcoming" ? "border-b-2 border-b2b-purple text-b2b-purple" : "text-gray-500"}`}
        >
          Upcoming events
        </Link>
        <Link
          href="/events/mine?tab=past"
          className={`pb-2 ${tab === "past" ? "border-b-2 border-b2b-purple text-b2b-purple" : "text-gray-500"}`}
        >
          Past events
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-6">
        <SectionCard>
          <form method="GET" className="flex flex-col gap-4">
            <input type="hidden" name="tab" value={tab} />
            <div>
              <label htmlFor="q" className="sr-only">
                Search my events by name or area
              </label>
              <input
                id="q"
                name="q"
                type="text"
                placeholder="Search my events by name or area"
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
                    {tab === "past" ? `Last ${TIME_RANGES[t].days} days` : `Next ${TIME_RANGES[t].days} days`}
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
                href={`/events/mine?tab=${tab}`}
                className="self-center text-sm text-b2b-ink/50 hover:underline"
              >
                Clear filters
              </a>
              <Link
                href="/discover?view=events"
                className="self-center text-sm text-b2b-ink/50 hover:underline"
              >
                Browse all events
              </Link>
            </div>
          </form>
        </SectionCard>

        {visibleEvents.length === 0 ? (
          <p className="text-b2b-ink/50">
            {q || time || distance
              ? "No events match those filters."
              : tab === "past"
                ? "No past events yet."
                : "You're not participating in or interested in any upcoming events yet."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleEvents.map(({ event, miles, pinned }) => {
              const isParticipating = event.participants.some((p) => p.userId === userId);
              const isInterested = event.interests.some((i) => i.userId === userId);
              return (
                <div
                  key={event.id}
                  className={`rounded-xl border bg-b2b-card p-4 ${
                    pinned ? "border-b2b-pink/40" : "border-b2b-purple/10"
                  } ${tab === "past" ? "opacity-75" : ""}`}
                >
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
                    <PinButton endpoint={`/api/events/${event.id}/pin`} initialPinned={pinned} />
                  </div>
                  {event.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-b2b-ink/70">{event.description}</p>
                  )}
                  {tab === "past" ? (
                    <div className="mt-3 flex gap-4 text-xs font-medium text-b2b-ink/60">
                      {isParticipating && <span>✓ You participated</span>}
                      {isInterested && <span>☆ You were interested</span>}
                    </div>
                  ) : (
                    <div className="mt-3">
                      <EventEngagementButtons
                        eventId={event.id}
                        initialParticipating={isParticipating}
                        initialInterested={isInterested}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
