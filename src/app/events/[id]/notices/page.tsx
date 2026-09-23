import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { EventChatFeed, type EventChatMessage } from "@/components/EventChatFeed";
import { parseTeammateRequests } from "@/lib/labels";

export default async function EventNoticesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      notices: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, photo: true } },
        },
      },
    },
  });
  if (!event) notFound();

  // Structured "looking for teammates" searches live on the main event page;
  // this page is just the plain free-text chat.
  const chatMessages: EventChatMessage[] = event.notices
    .filter((notice) => parseTeammateRequests(notice.teammateRequests).length === 0 && notice.text)
    .map((notice) => ({
      id: notice.id,
      text: notice.text!,
      createdAt: notice.createdAt,
      author: notice.user,
      isOwn: notice.userId === session.user.id,
    }));

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href={`/events/${event.id}`} className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to {event.name}
      </Link>

      <div className="mt-4">
        <SectionCard title="Event Chat">
          <p className="mb-3 text-sm text-b2b-ink/50">
            A lift, a training partner, or anything else about {event.name}.
          </p>
          <EventChatFeed eventId={event.id} messages={chatMessages} />
        </SectionCard>
      </div>
    </main>
  );
}
