import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { Avatar } from "@/components/Avatar";
import { ParticipateButton } from "@/components/ParticipateButton";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      participants: { where: { userId: session.user.id }, select: { id: true } },
      _count: { select: { participants: true, notices: true } },
    },
  });
  if (!event) notFound();

  const isParticipating = event.participants.length > 0;

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
            <ParticipateButton eventId={event.id} initialParticipating={isParticipating} />
          </div>

          {event.description && <p className="mt-4 text-sm text-b2b-ink/70">{event.description}</p>}
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
