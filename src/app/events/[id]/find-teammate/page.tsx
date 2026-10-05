import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { EventNoticesPanel } from "@/components/EventNoticesPanel";
import { assertEventVisible } from "@/lib/eventVisibility";

export default async function FindTeammatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();
  if (!(await assertEventVisible(event, session.user.id))) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href={`/events/${event.id}`} className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to {event.name}
      </Link>

      <div className="mt-4">
        <SectionCard title="Find a teammate">
          <p className="mb-3 text-sm text-b2b-ink/50">Looking for teammates for {event.name}? Post it here.</p>
          <EventNoticesPanel eventId={event.id} />
        </SectionCard>
      </div>
    </main>
  );
}
