import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { Avatar } from "@/components/Avatar";
import { showsSingleBadge } from "@/lib/labels";
import { conversationDisplayName } from "@/lib/conversations";

export default async function MessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: session.user.id } } },
    include: {
      participants: {
        where: { userId: { not: session.user.id } },
        include: {
          user: {
            select: { id: true, name: true, photo: true, isSingle: true, showSingleBadge: true, deletedAt: true },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { id: true, name: true } } },
      },
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
      // A deleted account's messages are kept (not wiped — see
      // /api/account/delete) so the thread survives for anyone who reported
      // them, but there's no reason a "Deleted User" placeholder should keep
      // cluttering the inbox.
      const others = conv.participants.map((p) => p.user).filter((u) => !u.deletedAt);
      const lastMessage = conv.messages[0] ?? null;
      return {
        id: conv.id,
        isGroup: conv.isGroup,
        displayName: conversationDisplayName(conv, others.map((u) => u.name)),
        avatarUser: others[0] ?? null,
        otherCount: others.length,
        lastMessage,
        sortAt: lastMessage?.createdAt ?? conv.createdAt,
        unreadCount: unreadByConversation.get(conv.id) ?? 0,
      };
    })
    .filter((row) => row.isGroup || row.otherCount > 0)
    .sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime());

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <div className="mt-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Messages</h1>
        <Link
          href="/messages/new"
          className="rounded bg-b2b-pink px-3 py-1.5 text-sm font-medium text-white hover:bg-b2b-pink-dark"
        >
          New message
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-b2b-ink/50">
          No conversations yet — start one with the button above, or message someone from their profile.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/messages/${row.id}`}
              className="flex items-center gap-3 rounded-xl border border-b2b-purple/10 bg-b2b-card p-3 transition hover:border-b2b-pink/30"
            >
              {row.isGroup ? (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-b2b-purple/10 text-lg font-semibold text-b2b-purple">
                  #
                </div>
              ) : (
                <Avatar
                  photo={row.avatarUser?.photo ?? null}
                  name={row.displayName}
                  size={48}
                  showSingleBadge={row.avatarUser ? showsSingleBadge(row.avatarUser) : false}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{row.displayName}</p>
                <p className="truncate text-sm text-b2b-ink/50">
                  {row.lastMessage
                    ? row.isGroup
                      ? `${row.lastMessage.sender.id === session.user.id ? "You" : row.lastMessage.sender.name}: ${row.lastMessage.text}`
                      : row.lastMessage.text
                    : "No messages yet"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="text-xs text-b2b-ink/40">
                  {row.sortAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                {row.unreadCount > 0 && (
                  <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-b2b-pink px-1.5 text-xs font-medium text-white">
                    {row.unreadCount}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
