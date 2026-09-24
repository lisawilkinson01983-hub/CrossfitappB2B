import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { Avatar } from "@/components/Avatar";
import { ChatThread } from "@/components/ChatThread";
import { showsSingleBadge } from "@/lib/labels";

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
      userOne: { select: { id: true, name: true, photo: true, isSingle: true, showSingleBadge: true } },
      userTwo: { select: { id: true, name: true, photo: true, isSingle: true, showSingleBadge: true } },
    },
  });

  if (
    !conversation ||
    (conversation.userOneId !== session.user.id && conversation.userTwoId !== session.user.id)
  ) {
    notFound();
  }

  const otherUser = conversation.userOneId === session.user.id ? conversation.userTwo : conversation.userOne;

  // Viewing the thread marks the other participant's messages as read.
  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: session.user.id }, readAt: null },
    data: { readAt: new Date() },
  });

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, name: true } } },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <Link href="/messages" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← All messages
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <Avatar
          photo={otherUser.photo}
          name={otherUser.name}
          size={40}
          showSingleBadge={showsSingleBadge(otherUser)}
        />
        <h1 className="text-xl font-bold">{otherUser.name}</h1>
      </div>

      <div className="mt-4">
        <ChatThread
          conversationId={conversationId}
          currentUserId={session.user.id}
          initialMessages={messages.map((m) => ({
            id: m.id,
            text: m.text,
            createdAt: m.createdAt.toISOString(),
            sender: m.sender,
          }))}
        />
      </div>
    </main>
  );
}
