import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { Avatar } from "@/components/Avatar";
import { showsSingleBadge } from "@/lib/labels";
import { assertEventVisible } from "@/lib/eventVisibility";

export default async function EventParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
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
  if (!(await assertEventVisible(event, session.user.id))) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href={`/events/${event.id}`} className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to {event.name}
      </Link>

      <div className="mt-4">
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
