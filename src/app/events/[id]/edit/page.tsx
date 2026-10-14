import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { EventSubmitForm } from "@/components/EventSubmitForm";
import { EventWorkoutsEditor } from "@/components/EventWorkoutsEditor";
import { DeleteEventButton } from "@/components/DeleteEventButton";
import { parseJsonArray } from "@/lib/labels";
import { BackLink } from "@/components/BackLink";
import { canEditEvent } from "@/lib/eventVisibility";
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
    include: { workouts: { orderBy: { number: "asc" } } },
  });
  if (!event) notFound();

  // The full event-details form (name, date, location, etc.) and the
  // structured workouts manager both open up to the organizer and a claiming
  // affiliate once a claim is approved (see Event.claimedById,
  // canEditEvent) — before that, both stay admin-only, as the form always
  // has been.
  if (!canEditEvent(event, session.user.id, !!me?.isAdmin)) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <BackLink href={`/events/${event.id}`} className="mt-6">Back to event</BackLink>

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

      <div className="mt-4">
        <SectionCard title="Workouts">
          <p className="mb-3 text-sm text-b2b-ink/50">
            Shown as numbered buttons on the event page — each opens its own page with Title, Standards, and
            Workflow.
          </p>
          <EventWorkoutsEditor eventId={event.id} workouts={event.workouts} />
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
