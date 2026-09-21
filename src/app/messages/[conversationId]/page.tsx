import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { ChatThread } from "@/components/ChatThread";

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
      userOne: { select: { id: true, name: true } },
      userTwo: { select: { id: true, name: true } },
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
    <main className="mx-auto max-w-2xl px-4 py-8">
      <NavBar />
      <div className="mt-6 flex items-center gap-3">
        <Link href="/messages" className="text-sm text-b2b-pink underline">
          ← All messages
        </Link>
        <h1 className="text-2xl font-bold">{otherUser.name}</h1>
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
