import { prisma } from "@/lib/prisma";

/**
 * A profile's unread counts — the red dots on the bell and Messages tab, and
 * (added together) the number on the store app's icon.
 */
export async function unreadCounts(userId: string): Promise<{ messages: number; notifications: number }> {
  const [messages, notifications] = await Promise.all([
    prisma.message.count({
      where: {
        conversation: { participants: { some: { userId } } },
        senderId: { not: userId },
        readAt: null,
      },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { messages, notifications };
}

export async function unreadBadgeCount(userId: string): Promise<number> {
  const { messages, notifications } = await unreadCounts(userId);
  return messages + notifications;
}
