import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { Avatar } from "@/components/Avatar";
import { ChatThread } from "@/components/ChatThread";
import { GroupHeader } from "@/components/GroupHeader";
import { showsSingleBadge } from "@/lib/labels";
import { conversationDisplayName, messageInclude } from "@/lib/conversations";
import { summarizeReactions } from "@/lib/reactions";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { conversationId } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, photo: true, isSingle: true, showSingleBadge: true, deletedAt: true } },
        },
      },
    },
  });

  if (!conversation || !conversation.participants.some((p) => p.userId === session.user.id)) {
    notFound();
  }

  const others = conversation.participants.map((p) => p.user).filter((u) => u.id !== session.user.id);
  const displayName = conversationDisplayName(conversation, others.filter((u) => !u.deletedAt).map((u) => u.name));

  // Viewing the thread marks the other participants' messages as read.
  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: session.user.id }, readAt: null },
    data: { readAt: new Date() },
  });

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    include: messageInclude,
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <Link href="/messages" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← All messages
      </Link>
      {conversation.isGroup ? (
        <div className="mt-3">
          <GroupHeader
            conversationId={conversationId}
            displayName={displayName}
            initialPhoto={conversation.photo}
            members={conversation.participants.map((p) => ({ id: p.userId, name: p.user.name, deletedAt: p.user.deletedAt }))}
            currentUserId={session.user.id}
          />
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <Avatar
            photo={others[0]?.photo ?? null}
            name={displayName}
            size={40}
            showSingleBadge={others[0] ? showsSingleBadge(others[0]) : false}
          />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{displayName}</h1>
          </div>
        </div>
      )}

      <div className="mt-4">
        <ChatThread
          conversationId={conversationId}
          currentUserId={session.user.id}
          isGroup={conversation.isGroup}
          initialMessages={messages.map((m) => ({
            id: m.id,
            text: m.text,
            gifUrl: m.gifUrl,
            photo: m.photo,
            video: m.video,
            videoThumbnail: m.videoThumbnail,
            createdAt: m.createdAt.toISOString(),
            editedAt: m.editedAt ? m.editedAt.toISOString() : null,
            deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
            sender: m.sender,
            reactions: summarizeReactions(m.reactions, session.user.id),
            replyTo: m.replyTo
              ? {
                  id: m.replyTo.id,
                  text: m.replyTo.text,
                  gifUrl: m.replyTo.gifUrl,
                  photo: m.replyTo.photo,
                  video: m.replyTo.video,
                  deletedAt: m.replyTo.deletedAt ? m.replyTo.deletedAt.toISOString() : null,
                  sender: m.replyTo.sender,
                }
              : null,
          }))}
        />
      </div>
    </main>
  );
}
