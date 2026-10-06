import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { ConversationRow, type ConversationRowData } from "@/components/ConversationRow";
import { showsSingleBadge } from "@/lib/labels";
import { conversationDisplayName } from "@/lib/conversations";
import { formatDate } from "@/lib/dates";
import { stripMentionMarkup } from "@/lib/mentions";

export default async function MessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: session.user.id } } },
    include: {
      participants: {
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

  const rows: (ConversationRowData & { sortAt: Date })[] = conversations
    .map((conv) => {
      const me = conv.participants.find((p) => p.userId === session.user.id);
      // A deleted account's messages are kept (not wiped — see
      // /api/account/delete) so the thread survives for anyone who reported
      // them, but there's no reason a "Deleted User" placeholder should keep
      // cluttering the inbox.
      const others = conv.participants.filter((p) => p.userId !== session.user.id).map((p) => p.user).filter((u) => !u.deletedAt);
      const lastMessage = conv.messages[0] ?? null;
      const sortAt = lastMessage?.createdAt ?? conv.createdAt;
      // Swiped out of the inbox (see DELETE /api/conversations/[id]) — stays
      // hidden only while nothing new has happened since, so an active
      // thread quietly resurfaces instead of vanishing for good.
      const hidden = Boolean(me?.hiddenAt) && me!.hiddenAt! >= sortAt;
      const avatarUser = others[0] ?? null;
      return {
        id: conv.id,
        isGroup: conv.isGroup,
        displayName: conversationDisplayName(conv, others.map((u) => u.name)),
        photo: conv.isGroup ? conv.photo : (avatarUser?.photo ?? null),
        showSingleBadge: avatarUser ? showsSingleBadge(avatarUser) : false,
        lastMessagePreview: lastMessage
          ? conv.isGroup
            ? `${lastMessage.sender.id === session.user.id ? "You" : lastMessage.sender.name}: ${stripMentionMarkup(lastMessage.text)}`
            : stripMentionMarkup(lastMessage.text)
          : "No messages yet",
        dateLabel: formatDate(sortAt, { month: "short", day: "numeric" }),
        unreadCount: unreadByConversation.get(conv.id) ?? 0,
        sortAt,
        otherCount: others.length,
        hidden,
      };
    })
    .filter((row) => (row.isGroup || row.otherCount > 0) && !row.hidden)
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
        <>
          <p className="mt-4 text-xs text-b2b-ink/40">Swipe a conversation left to remove it from your inbox.</p>
          <div className="mt-2 flex flex-col gap-2">
            {rows.map((row) => (
              <ConversationRow key={row.id} row={row} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
