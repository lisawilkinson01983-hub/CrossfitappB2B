import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { Avatar } from "@/components/Avatar";
import { EventEngagementButtons } from "@/components/EventEngagementButtons";
import { EventNoticesPanel, type EventNoticeEntry } from "@/components/EventNoticesPanel";
import { CollapsibleText } from "@/components/CollapsibleText";
import { InviteToEventForm } from "@/components/InviteToEventForm";
import { MessageAttendeesButton } from "@/components/MessageAttendeesButton";
import { parseJsonArray, parseTeammateRequests, eventKindLabel } from "@/lib/labels";
import { formatEventDate } from "@/lib/eventDate";
import { assertEventVisible } from "@/lib/eventVisibility";
import {
  EVENT_DIVISION_LABELS,
  EVENT_TEAM_FORMAT_LABELS,
  EVENT_GENDER_CATEGORY_LABELS,
} from "@/lib/labels";
import type {
  EventDivisionOption,
  EventTeamFormatOption,
  EventGenderCategoryOption,
  TeammateDivisionOption,
  TeammateGenderOption,
} from "@/lib/validation";

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
      notices: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, photo: true } },
          likes: { select: { userId: true } },
          comments: {
            orderBy: { createdAt: "asc" },
            include: { user: { select: { id: true, name: true } } },
          },
        },
      },
      teammateAlerts: {
        where: { userId: session.user.id },
        select: { id: true, gender: true, division: true },
      },
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

  const noticeEntries: EventNoticeEntry[] = event.notices
    .map((notice) => ({
      notice: {
        id: notice.id,
        text: notice.text,
        teammateRequests: parseTeammateRequests(notice.teammateRequests),
        createdAt: notice.createdAt,
        author: notice.user,
        likeCount: notice.likes.length,
        likedByMe: notice.likes.some((l) => l.userId === session.user.id),
        comments: notice.comments.map((c) => ({
          id: c.id,
          text: c.text,
          createdAt: c.createdAt,
          author: c.user,
          parentId: c.parentId,
          isMine: c.userId === session.user.id,
        })),
      },
      isOwn: notice.userId === session.user.id,
      isAuthorParticipating: participantIds.has(notice.userId),
    }))
    .filter((entry) => entry.notice.teammateRequests.length > 0);

  // Every notice — search or free text — shows up on the shared notice board.
  const chatMessageCount = event.notices.length;

  const myAlerts = event.teammateAlerts.map((a) => ({
    id: a.id,
    gender: a.gender as TeammateGenderOption,
    division: a.division as TeammateDivisionOption,
  }));

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
        {me?.isAdmin && (
          <Link href={`/events/${event.id}/edit`} className="text-sm text-b2b-purple underline">
            Edit event
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
            />

            <div className="grid w-full grid-cols-2 gap-3">
              <Link
                href={`/events/${event.id}/participants`}
                className="rounded-xl border border-gray-300 bg-b2b-card px-4 py-3 text-center text-sm font-medium text-b2b-ink hover:bg-b2b-bg"
              >
                Athletes ({event.participants.length})
              </Link>
              <Link
                href={`/events/${event.id}/notices`}
                className="rounded-xl border border-b2b-purple/20 bg-b2b-purple/10 px-4 py-3 text-center text-sm font-medium text-b2b-purple hover:bg-b2b-purple/20"
              >
                Notice Board{chatMessageCount > 0 ? ` (${chatMessageCount})` : ""}
              </Link>
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
        <SectionCard title="Search">
          <p className="mb-3 text-sm text-b2b-ink/50">Looking for teammates for {event.name}? Post it here.</p>
          <EventNoticesPanel eventId={event.id} notices={noticeEntries} myAlerts={myAlerts} />
        </SectionCard>
      </div>
    </main>
  );
}
