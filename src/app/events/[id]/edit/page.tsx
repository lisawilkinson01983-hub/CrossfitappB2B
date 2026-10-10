import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { EventSubmitForm } from "@/components/EventSubmitForm";
import { EventWorkoutsCarousel } from "@/components/EventWorkoutsCarousel";
import { DeleteEventButton } from "@/components/DeleteEventButton";
import { parseJsonArray } from "@/lib/labels";
import { BackLink } from "@/components/BackLink";
import type { EventDivisionOption, EventGenderCategoryOption, EventTeamFormatOption } from "@/lib/validation";

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });

  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: { workoutPhotos: { orderBy: { createdAt: "asc" }, select: { id: true, photo: true, userId: true } } },
  });
  if (!event) notFound();

  const isOrganizer = event.createdById === session.user.id || event.submittedById === session.user.id;
  // The full event-details form (name, date, location, etc.) stays
  // admin-only, as it always has been — only the Workout posters section
  // below is opened up to the organizer themself.
  if (!me?.isAdmin && !isOrganizer) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <BackLink href={`/events/${event.id}`} className="mt-6">Back to event</BackLink>

      {me?.isAdmin && (
        <div className="mt-4">
          <SectionCard title={`Edit "${event.name}"`}>
            <EventSubmitForm
              mode="edit"
              eventId={event.id}
              initial={{
                name: event.name,
                date: toDateInputValue(event.date),
                endDate: toDateInputValue(event.endDate),
                isOnline: event.isOnline,
                location: event.location ?? "",
                websiteUrl: event.websiteUrl ?? "",
                description: event.description ?? "",
                division: parseJsonArray<EventDivisionOption>(event.division),
                teamFormat: parseJsonArray<EventTeamFormatOption>(event.teamFormat),
                genderCategory: parseJsonArray<EventGenderCategoryOption>(event.genderCategory),
                photo: event.photo,
                eventKind: event.eventKind ?? "",
                eventKindOther: event.eventKindOther ?? "",
              }}
            />
          </SectionCard>
        </div>
      )}

      <div className="mt-4">
        <SectionCard title="Workout posters">
          <p className="mb-3 text-sm text-b2b-ink/50">
            Posted here show up in the "Workouts" carousel on the event page — e.g. a poster of the released
            competition workouts.
          </p>
          <EventWorkoutsCarousel
            eventId={event.id}
            photos={event.workoutPhotos}
            currentUserId={session.user.id}
            canAdd
            isOrganizerOrAdmin
          />
        </SectionCard>
      </div>

      {me?.isAdmin && (
        <div className="mt-4">
          <SectionCard title="Danger Zone">
            <DeleteEventButton eventId={event.id} eventName={event.name} />
          </SectionCard>
        </div>
      )}
    </main>
  );
}
