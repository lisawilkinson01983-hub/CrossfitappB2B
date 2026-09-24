import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { EventSubmitForm } from "@/components/EventSubmitForm";
import { parseJsonArray } from "@/lib/labels";
import type { EventDivisionOption, EventGenderCategoryOption, EventTeamFormatOption } from "@/lib/validation";

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) notFound();

  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href={`/events/${event.id}`} className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to event
      </Link>

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
            }}
          />
        </SectionCard>
      </div>
    </main>
  );
}
