import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";

export default async function MessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ userOneId: session.user.id }, { userTwoId: session.user.id }] },
    include: {
      userOne: { select: { id: true, name: true, photo: true } },
      userTwo: { select: { id: true, name: true, photo: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const conversationIds = conversations.map((c) => c.id);
  const unreadRows = await prisma.message.groupBy({
    by: ["conversationId"],
    where: { conversationId: { in: conversationIds }, senderId: { not: session.user.id }, readAt: null },
    _count: { id: true },
  });
  const unreadByConversation = new Map(unreadRows.map((r) => [r.conversationId, r._count.id]));

  const rows = conversations
    .map((conv) => {
      const otherUser = conv.userOneId === session.user.id ? conv.userTwo : conv.userOne;
      const lastMessage = conv.messages[0] ?? null;
      return {
        id: conv.id,
        otherUser,
        lastMessage,
        sortAt: lastMessage?.createdAt ?? conv.createdAt,
        unreadCount: unreadByConversation.get(conv.id) ?? 0,
      };
    })
    .sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime());

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <h1 className="mt-6 text-2xl font-bold">Messages</h1>

      {rows.length === 0 ? (
        <p className="mt-6 text-gray-500">
          No conversations yet — message someone from their profile to start one.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/messages/${row.id}`}
              className="flex items-center gap-3 rounded border border-gray-200 bg-b2b-card p-3 hover:bg-gray-50"
            >
              {row.otherUser.photo ? (
                <Image
                  src={row.otherUser.photo}
                  alt={row.otherUser.name}
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-500">
                  {row.otherUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{row.otherUser.name}</p>
                <p className="truncate text-sm text-gray-500">
                  {row.lastMessage ? row.lastMessage.text : "No messages yet"}
                </p>
              </div>
              {row.unreadCount > 0 && (
                <span className="rounded-full bg-b2b-pink px-2 py-0.5 text-xs font-medium text-white">
                  {row.unreadCount}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
