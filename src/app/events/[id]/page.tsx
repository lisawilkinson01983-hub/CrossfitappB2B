import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { Avatar } from "@/components/Avatar";
import { EventEngagementButtons } from "@/components/EventEngagementButtons";
import { EventWorkoutsCarousel } from "@/components/EventWorkoutsCarousel";
import { CollapsibleText } from "@/components/CollapsibleText";
import { InviteToEventForm } from "@/components/InviteToEventForm";
import { MessageAttendeesButton } from "@/components/MessageAttendeesButton";
import { ShareEventButton } from "@/components/ShareEventButton";
import { parseJsonArray, eventKindLabel, isCompetitionEvent } from "@/lib/labels";
import { formatEventDate } from "@/lib/eventDate";
import { assertEventVisible } from "@/lib/eventVisibility";
import {
  EVENT_DIVISION_LABELS,
  EVENT_TEAM_FORMAT_LABELS,
  EVENT_GENDER_CATEGORY_LABELS,
} from "@/lib/labels";
import type { EventDivisionOption, EventTeamFormatOption, EventGenderCategoryOption } from "@/lib/validation";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, photo: true } },
      participants: { select: { userId: true } },
      interests: { where: { userId: session.user.id }, select: { id: true } },
      _count: { select: { interests: true } },
      // Only the count is needed here — the notices themselves are rendered
      // on the dedicated Notice Board page.
      notices: { select: { id: true } },
      workoutPhotos: { orderBy: { createdAt: "asc" }, select: { id: true, photo: true, userId: true } },
    },
  });
  if (!event) notFound();
  if (!(await assertEventVisible(event, session.user.id))) notFound();

  const isOrganizer = event.createdById === session.user.id || event.submittedById === session.user.id;
  const gymOptions = event.isPrivate && isOrganizer
    ? (await prisma.gym.findMany({ where: { status: "APPROVED" }, select: { name: true }, orderBy: { name: "asc" } })).map(
        (g) => g.name
      )
    : [];

  const participantIds = new Set(event.participants.map((p) => p.userId));
  const isParticipating = participantIds.has(session.user.id);
  const isInterested = event.interests.length > 0;

  // Every notice — search or free text — shows up on the shared notice board.
  const chatMessageCount = event.notices.length;

  const division = parseJsonArray<EventDivisionOption>(event.division);
  const teamFormat = parseJsonArray<EventTeamFormatOption>(event.teamFormat);
  const genderCategory = parseJsonArray<EventGenderCategoryOption>(event.genderCategory);
  // "N/A" opts a field out entirely (see EventSubmitForm) — nothing useful to
  // show for it, so it's dropped rather than rendered as its own tag.
  const categoryTags = [
    ...division.filter((v) => v !== "NA").map((v) => EVENT_DIVISION_LABELS[v]),
    ...teamFormat.filter((v) => v !== "NA").map((v) => EVENT_TEAM_FORMAT_LABELS[v]),
    ...genderCategory.filter((v) => v !== "NA").map((v) => EVENT_GENDER_CATEGORY_LABELS[v]),
  ];
  const kindLabel = eventKindLabel(event);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <div className="mt-6 flex items-center justify-between">
        <Link href="/discover?view=events" className="inline-block text-sm text-b2b-pink underline">
          ← Back to events
        </Link>
        {(isOrganizer || me?.isAdmin) && (
          <Link href={`/events/${event.id}/edit`} className="text-sm text-b2b-purple underline">
            {me?.isAdmin ? "Edit event" : "Event settings"}
          </Link>
        )}
      </div>

      <div className="mt-4">
        <SectionCard>
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar photo={event.photo} name={event.name} size={112} />
            <div>
              <p className="text-xl font-semibold">
                {event.name}
                {event.isPrivate && (
                  <span className="ml-2 rounded-full bg-b2b-purple/10 px-2 py-0.5 text-xs text-b2b-purple">
                    🔒 Private
                  </span>
                )}
                {kindLabel && (
                  <span className="ml-2 rounded-full bg-b2b-purple/10 px-2 py-0.5 text-xs text-b2b-purple">
                    {kindLabel}
                  </span>
                )}
                {event.tag && (
                  <span className="ml-2 rounded-full bg-b2b-purple/10 px-2 py-0.5 text-xs text-b2b-purple">
                    {event.tag}
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-b2b-ink/50">
                {formatEventDate(event)} · {event.isOnline ? "Online" : event.location}
              </p>
              {event.createdBy && (
                <p className="mt-1 text-xs text-b2b-ink/40">
                  Organized by{" "}
                  <Link href={`/profile/${event.createdBy.id}`} className="font-medium text-b2b-ink/60 hover:underline">
                    {event.createdBy.name}
                  </Link>
                </p>
              )}
            </div>
            <EventEngagementButtons
              eventId={event.id}
              initialParticipating={isParticipating}
              initialInterested={isInterested}
              isCompetition={isCompetitionEvent(event)}
            />

            {/* The two things someone's most likely here to do — given equal
                weight so neither gets missed, and placed right after the
                engagement toggle since they matter more than the stats
                below. */}
            <div className="flex w-full flex-col gap-2">
              <Link
                href={`/events/${event.id}/find-teammate`}
                className="rounded-xl bg-b2b-pink px-4 py-3 text-center text-sm font-bold text-white hover:bg-b2b-pink-dark"
              >
                Find a teammate
              </Link>
              <Link
                href={`/events/${event.id}/notices`}
                className="rounded-xl bg-b2b-pink px-4 py-3 text-center text-sm font-bold text-white hover:bg-b2b-pink-dark"
              >
                Notice Board{chatMessageCount > 0 ? ` · ${chatMessageCount} new` : ""}
              </Link>
            </div>

            {/* Quick stats + utilities, kept small so they don't compete with
                the two CTAs above. */}
            <div className="flex w-full flex-wrap items-center justify-center gap-2">
              <Link
                href={`/events/${event.id}/participants`}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-b2b-card px-3.5 py-2 text-xs font-semibold text-b2b-ink hover:bg-b2b-bg"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                  <circle cx="10" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {event.participants.length} athletes
              </Link>
              <Link
                href={`/events/${event.id}/interested`}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-b2b-card px-3.5 py-2 text-xs font-semibold text-b2b-ink hover:bg-b2b-bg"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {event._count.interests} interested
              </Link>
              {!event.isPrivate && (
                <ShareEventButton
                  eventId={event.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-b2b-card px-3.5 py-2 text-xs font-semibold text-b2b-ink hover:bg-b2b-bg"
                />
              )}
            </div>
          </div>

          {event.description && (
            <CollapsibleText text={event.description} className="mt-4 text-sm text-b2b-ink/70" />
          )}

          {categoryTags.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              {categoryTags.map((tag) => (
                <span key={tag} className="rounded-full bg-b2b-purple/10 px-2 py-0.5 text-xs text-b2b-purple">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {event.websiteUrl && (
            <a
              href={event.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block text-center text-sm text-b2b-pink underline"
            >
              Event website
            </a>
          )}

          {event.isPrivate && isOrganizer && (
            <div className="mt-4 flex flex-col gap-3">
              {event.participants.some((p) => p.userId !== session.user.id) && (
                <MessageAttendeesButton eventId={event.id} />
              )}
              <InviteToEventForm eventId={event.id} gymOptions={gymOptions} />
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Workouts">
          <EventWorkoutsCarousel
            eventId={event.id}
            photos={event.workoutPhotos}
            currentUserId={session.user.id}
            readOnly
          />
        </SectionCard>
      </div>
    </main>
  );
}
