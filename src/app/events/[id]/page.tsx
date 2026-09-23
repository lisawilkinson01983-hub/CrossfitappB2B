import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { Avatar } from "@/components/Avatar";
import { EventEngagementButtons } from "@/components/EventEngagementButtons";
import { parseJsonArray } from "@/lib/labels";
import {
  EVENT_DIVISION_LABELS,
  EVENT_TEAM_FORMAT_LABELS,
  EVENT_GENDER_CATEGORY_LABELS,
} from "@/lib/labels";
import type {
  EventDivisionOption,
  EventTeamFormatOption,
  EventGenderCategoryOption,
} from "@/lib/validation";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      participants: { where: { userId: session.user.id }, select: { id: true } },
      interests: { where: { userId: session.user.id }, select: { id: true } },
      _count: { select: { participants: true, notices: true } },
    },
  });
  if (!event) notFound();

  const isParticipating = event.participants.length > 0;
  const isInterested = event.interests.length > 0;

  const division = parseJsonArray<EventDivisionOption>(event.division);
  const teamFormat = parseJsonArray<EventTeamFormatOption>(event.teamFormat);
  const genderCategory = parseJsonArray<EventGenderCategoryOption>(event.genderCategory);
  const categoryTags = [
    ...division.map((v) => EVENT_DIVISION_LABELS[v]),
    ...teamFormat.map((v) => EVENT_TEAM_FORMAT_LABELS[v]),
    ...genderCategory.map((v) => EVENT_GENDER_CATEGORY_LABELS[v]),
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href="/discover?view=events" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to events
      </Link>

      <div className="mt-4">
        <SectionCard>
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar photo={event.photo} name={event.name} size={112} />
            <div>
              <p className="text-xl font-semibold">
                {event.name}
                {event.tag && (
                  <span className="ml-2 rounded-full bg-b2b-purple/10 px-2 py-0.5 text-xs text-b2b-purple">
                    {event.tag}
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-b2b-ink/50">
                {event.date.toLocaleDateString(undefined, {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {event.location}
              </p>
            </div>
            <EventEngagementButtons
              eventId={event.id}
              initialParticipating={isParticipating}
              initialInterested={isInterested}
            />
          </div>

          {event.description && <p className="mt-4 text-sm text-b2b-ink/70">{event.description}</p>}

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
        </SectionCard>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link
          href={`/events/${event.id}/participants`}
          className="rounded-xl border border-gray-300 bg-b2b-card px-4 py-3 text-center text-sm font-medium text-b2b-ink hover:bg-b2b-bg"
        >
          👥 {event._count.participants} {event._count.participants === 1 ? "athlete" : "athletes"}
        </Link>
        <Link
          href={`/events/${event.id}/notices`}
          className="rounded-xl border border-b2b-purple/20 bg-b2b-purple/10 px-4 py-3 text-center text-sm font-medium text-b2b-purple hover:bg-b2b-purple/20"
        >
          📣 Notices{event._count.notices > 0 ? ` (${event._count.notices})` : ""}
        </Link>
      </div>
    </main>
  );
}
