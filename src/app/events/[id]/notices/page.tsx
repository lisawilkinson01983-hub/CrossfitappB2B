import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { EventChatFeed } from "@/components/EventChatFeed";
import { BackLink } from "@/components/BackLink";
import type { EventNoticeEntry } from "@/components/EventNoticeCard";
import { parseTeammateRequests } from "@/lib/labels";
import { assertEventVisible } from "@/lib/eventVisibility";
import { summarizeReactions } from "@/lib/reactions";

export default async function EventNoticesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, photo: true },
  });

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
            include: {
              user: { select: { id: true, name: true } },
              reactions: { select: { emoji: true, userId: true } },
            },
          },
        },
      },
    },
  });
  if (!event) notFound();
  if (!(await assertEventVisible(event, session.user.id))) notFound();

  const participantIds = new Set(event.participants.map((p) => p.userId));

  // Every notice — a teammate search posted from the separate "Find a
  // teammate" page, or free text from the composer below — shows up
  // together here on the shared notice board.
  const chatEntries: EventNoticeEntry[] = event.notices.map((notice) => ({
    notice: {
      id: notice.id,
      text: notice.text,
      photo: notice.photo,
      video: notice.video,
      videoThumbnail: notice.videoThumbnail,
      gifUrl: notice.gifUrl,
      teammateRequests: parseTeammateRequests(notice.teammateRequests),
      createdAt: notice.createdAt,
      author: notice.user,
      likeCount: notice.likes.length,
      likedByMe: notice.likes.some((l) => l.userId === session.user.id),
      comments: notice.comments.map((c) => ({
        id: c.id,
        text: c.text,
        gifUrl: c.gifUrl,
        photo: c.photo,
        video: c.video,
        videoThumbnail: c.videoThumbnail,
        createdAt: c.createdAt,
        author: c.user,
        parentId: c.parentId,
        isMine: c.userId === session.user.id,
        reactions: summarizeReactions(c.reactions, session.user.id),
      })),
    },
    isOwn: notice.userId === session.user.id,
    isAuthorParticipating: participantIds.has(notice.userId),
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <BackLink href={`/events/${event.id}`} className="mt-6">Back to {event.name}</BackLink>

      <h1 className="mt-4 text-2xl font-bold">Message Board</h1>
      <p className="mt-1 text-sm text-b2b-ink/50">
        A lift, a training partner, or anything else about {event.name}.
      </p>

      <div className="mt-4">
        <EventChatFeed
          eventId={event.id}
          notices={chatEntries}
          currentUserName={currentUser?.name ?? "You"}
          currentUserPhoto={currentUser?.photo ?? null}
        />
      </div>
    </main>
  );
}
