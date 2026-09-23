import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { EventNoticesPanel, type EventNoticeEntry } from "@/components/EventNoticesPanel";
import { parseTeammateRequests } from "@/lib/labels";

export default async function EventNoticesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      participants: { select: { userId: true } },
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
    },
  });
  if (!event) notFound();

  const participantIds = new Set(event.participants.map((p) => p.userId));

  const noticeEntries: EventNoticeEntry[] = event.notices.map((notice) => ({
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
      })),
    },
    isOwn: notice.userId === session.user.id,
    isAuthorParticipating: participantIds.has(notice.userId),
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href={`/events/${event.id}`} className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to {event.name}
      </Link>

      <div className="mt-4 flex flex-col gap-6">
        <SectionCard title="Notices">
          <p className="mb-3 text-sm text-b2b-ink/50">
            Looking for teammates, a lift, or a training partner for {event.name}? Post it here.
          </p>
          <EventNoticesPanel eventId={event.id} notices={noticeEntries} />
        </SectionCard>
      </div>
    </main>
  );
}
