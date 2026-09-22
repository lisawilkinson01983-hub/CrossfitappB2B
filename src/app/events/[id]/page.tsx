import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { Avatar } from "@/components/Avatar";
import { ParticipateButton } from "@/components/ParticipateButton";
import { showsSingleBadge } from "@/lib/labels";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      participants: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, photo: true, isSingle: true, showSingleBadge: true } },
        },
      },
    },
  });
  if (!event) notFound();

  const isParticipating = event.participants.some((p) => p.userId === session.user.id);

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

      <div className="mt-6">
        <SectionCard
          title={`${event.participants.length} ${event.participants.length === 1 ? "athlete" : "athletes"} participating`}
        >
          {event.participants.length === 0 ? (
            <p className="text-b2b-ink/40">No one's joined yet — be the first!</p>
          ) : (
            <div className="flex flex-col gap-3">
              {event.participants.map((p) => (
                <Link
                  key={p.id}
                  href={`/profile/${p.user.id}`}
                  className="flex items-center gap-3 hover:underline"
                >
                  <Avatar
                    photo={p.user.photo}
                    name={p.user.name}
                    size={36}
                    showSingleBadge={showsSingleBadge(p.user)}
                  />
                  <span className="text-sm font-medium">{p.user.name}</span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
