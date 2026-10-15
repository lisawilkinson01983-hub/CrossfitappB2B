import Link from "next/link";
import Image from "next/image";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { Avatar } from "@/components/Avatar";
import { EventEngagementButtons } from "@/components/EventEngagementButtons";
import { EventPlatformBadge } from "@/components/EventPlatformBadge";
import { EventTabs } from "@/components/EventTabs";
import { EventWorkoutsList } from "@/components/EventWorkoutsList";
import { ListOrCarousel } from "@/components/ListOrCarousel";
import { SwipeCardList, type SwipeCardItem } from "@/components/SwipeCardList";
import { CollapsibleText } from "@/components/CollapsibleText";
import { InviteToEventForm } from "@/components/InviteToEventForm";
import { MessageAttendeesButton } from "@/components/MessageAttendeesButton";
import { ShareEventButton } from "@/components/ShareEventButton";
import { ClaimEventButton } from "@/components/ClaimEventButton";
import { BackIcon } from "@/components/BackIcon";
import { EditIcon } from "@/components/EditIcon";
import { parseJsonArray, eventKindLabel, isCompetitionEvent } from "@/lib/labels";
import { formatEventDate } from "@/lib/eventDate";
import { assertEventVisible } from "@/lib/eventVisibility";
import { detectEventPlatform } from "@/lib/eventWebsite";
import {
  EVENT_DIVISION_LABELS,
  EVENT_TEAM_FORMAT_LABELS,
  EVENT_GENDER_CATEGORY_LABELS,
} from "@/lib/labels";
import type { EventDivisionOption, EventTeamFormatOption, EventGenderCategoryOption } from "@/lib/validation";

// Shown behind the hero photo while it loads, and in place of it when the
// event has none — the same gold-stripe-on-ink pattern as the swipeable
// cards elsewhere (see SwipeCardList's NO_PHOTO_PATTERN), so a photo-less
// event still reads as "on brand" rather than a broken image.
const NO_PHOTO_PATTERN = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(184,132,42,0.22) 0px, rgba(184,132,42,0.22) 2px, transparent 2px, transparent 18px)",
};

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true, accountType: true } });

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, photo: true } },
      participants: { select: { userId: true } },
      interests: { where: { userId: session.user.id }, select: { id: true } },
      // Only the count is needed here for notices — they're rendered on the
      // dedicated Message Board page. Workouts are rendered in full, right
      // in the Overview section below.
      _count: { select: { interests: true } },
      notices: { select: { id: true } },
      workouts: { orderBy: { number: "asc" }, select: { number: true, title: true, photo: true } },
    },
  });
  if (!event) notFound();
  if (!(await assertEventVisible(event, session.user.id))) notFound();

  const isOrganizer = event.createdById === session.user.id || event.submittedById === session.user.id;
  // Whether to offer "Claim this event" — any affiliate not already the
  // organizer or the current claimant, as long as nobody else has claimed it
  // (see Event.claimedById/claimRequestedById, /api/events/[id]/claim).
  const hasPendingClaimFromMe = event.claimRequestedById === session.user.id;
  const canOfferClaim =
    me?.accountType === "AFFILIATE" &&
    !isOrganizer &&
    event.claimedById !== session.user.id &&
    !event.claimedById &&
    !event.claimRequestedById;
  const canEdit = isOrganizer || event.claimedById === session.user.id || me?.isAdmin;
  const gymOptions = event.isPrivate && isOrganizer
    ? (await prisma.gym.findMany({ where: { status: "APPROVED" }, select: { name: true }, orderBy: { name: "asc" } })).map(
        (g) => g.name
      )
    : [];

  const participantIds = new Set(event.participants.map((p) => p.userId));
  const isParticipating = participantIds.has(session.user.id);
  const isInterested = event.interests.length > 0;

  // Every notice — search or free text — shows up on the shared message board.
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
  const eventPlatform = detectEventPlatform(event.websiteUrl);
  // A private non-competition event (social, or anything else that isn't a
  // competition — e.g. a karaoke night filed under "Other") has no "team" to
  // find, and "athletes" reads oddly for people just showing up — so both
  // get dropped/renamed here.
  const isPrivateSocial = event.isPrivate && !isCompetitionEvent(event);

  const workoutCarouselItems: SwipeCardItem[] = event.workouts.map((workout) => ({
    id: String(workout.number),
    image: workout.photo,
    initial: String(workout.number),
    title: `${workout.number}. ${workout.title}`,
    href: `/events/${event.id}/workouts/${workout.number}`,
  }));

  const overviewContent = (
    <div className="flex flex-col gap-4">
      {event.description && <CollapsibleText text={event.description} className="text-sm text-b2b-ink/70" />}

      {categoryTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {categoryTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-b2b-purple/20 px-2.5 py-0.5 text-xs text-b2b-ink/60"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {event.workouts.length > 0 && (
        <ListOrCarousel
          label={`${event.workouts.length} ${event.workouts.length === 1 ? "workout" : "workouts"}`}
          defaultView="list"
          list={<EventWorkoutsList eventId={event.id} workouts={event.workouts} />}
          carousel={<SwipeCardList items={workoutCarouselItems} emptyMessage="Check back soon." hideHeader />}
        />
      )}

      {event.websiteUrl && (
        <a
          href={event.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl border-[1.5px] border-b2b-pink px-4 py-3 text-center text-sm font-bold text-b2b-pink hover:bg-b2b-pink/5"
        >
          Visit event website &#8599;
        </a>
      )}

      {!event.isPrivate && (
        <ShareEventButton
          eventId={event.id}
          className="w-full rounded-xl border border-b2b-purple/20 px-4 py-3 text-center text-sm font-semibold text-b2b-ink/60 hover:bg-b2b-bg"
        />
      )}

      {event.isPrivate && isOrganizer && (
        <div className="flex flex-col gap-3">
          {event.participants.some((p) => p.userId !== session.user.id) && (
            <MessageAttendeesButton eventId={event.id} />
          )}
          <InviteToEventForm eventId={event.id} gymOptions={gymOptions} />
        </div>
      )}
    </div>
  );

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <div className="relative -mx-4 mt-6 h-[260px] overflow-hidden sm:-mx-0 sm:rounded-2xl">
        <div className="absolute inset-0 bg-b2b-ink" style={event.photo ? undefined : NO_PHOTO_PATTERN}>
          {event.photo ? (
            <Image src={event.photo} alt="" fill sizes="(min-width: 640px) 640px, 100vw" className="object-cover" />
          ) : (
            <span className="absolute -bottom-6 -right-2 font-display text-[11rem] leading-none text-b2b-pink/25">
              {event.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="absolute left-3 top-3 z-10">
          <Link
            href="/discover?view=events"
            aria-label="Back to events"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm hover:bg-black/50"
          >
            <BackIcon className="h-[18px] w-[18px]" />
          </Link>
        </div>

        {eventPlatform && (
          <div className="absolute right-3 top-3 z-10">
            <EventPlatformBadge platform={eventPlatform} />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-5 pb-4 pt-14 text-left">
          <div className="flex flex-wrap gap-1.5">
            {event.isPrivate && (
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                🔒 Private
              </span>
            )}
            {kindLabel && (
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                {kindLabel}
              </span>
            )}
            {event.tag && (
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                {event.tag}
              </span>
            )}
          </div>
          <h1 className="mt-1.5 font-display text-3xl leading-tight text-white drop-shadow-sm">{event.name}</h1>
          <p className="mt-1 text-sm text-white/85">
            {formatEventDate(event)} · {event.isOnline ? "Online" : event.location}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          {event.createdBy ? (
            <div className="flex items-center gap-2">
              <Avatar photo={event.createdBy.photo} name={event.createdBy.name} size={26} />
              <div>
                <p className="text-xs text-b2b-ink/50">
                  Organized by{" "}
                  <Link href={`/profile/${event.createdBy.id}`} className="font-semibold text-b2b-ink/70 hover:underline">
                    {event.createdBy.name}
                  </Link>
                </p>
                {hasPendingClaimFromMe && (
                  <p className="text-xs text-b2b-ink/40">Your claim request is pending admin review.</p>
                )}
                {canOfferClaim && <ClaimEventButton eventId={event.id} />}
              </div>
            </div>
          ) : (
            <div />
          )}
          {canEdit && (
            <Link
              href={`/events/${event.id}/edit`}
              aria-label={me?.isAdmin ? "Edit event" : "Event settings"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-b2b-purple/20 text-b2b-purple hover:border-b2b-pink/40 hover:text-b2b-pink"
            >
              <EditIcon className="h-4 w-4" />
            </Link>
          )}
        </div>

        <EventEngagementButtons
          eventId={event.id}
          initialParticipating={isParticipating}
          initialInterested={isInterested}
          isCompetition={isCompetitionEvent(event)}
        />

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/events/${event.id}/participants`}
            className="flex flex-col items-center gap-0.5 rounded-2xl border border-b2b-purple/10 bg-b2b-card py-3 hover:border-b2b-pink/30"
          >
            <span className="font-display text-2xl text-b2b-pink">{event.participants.length}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-b2b-ink/45">
              {isPrivateSocial ? "Attendees" : "Athletes"}
            </span>
          </Link>
          <Link
            href={`/events/${event.id}/interested`}
            className="flex flex-col items-center gap-0.5 rounded-2xl border border-b2b-purple/10 bg-b2b-card py-3 hover:border-b2b-pink/30"
          >
            <span className="font-display text-2xl text-b2b-pink">{event._count.interests}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-b2b-ink/45">Interested</span>
          </Link>
        </div>

        <EventTabs
          overview={overviewContent}
          findTeamHref={isPrivateSocial ? null : `/events/${event.id}/find-teammate`}
          noticesHref={`/events/${event.id}/notices`}
          noticesCount={chatMessageCount}
        />
      </div>
    </main>
  );
}
