import { prisma } from "@/lib/prisma";
import { hiddenInAppTypes, parseNotificationPrefs } from "@/lib/notificationSettings";

/**
 * A profile's unread counts — the red dots on the bell and Messages tab, and
 * (added together) the number on the store app's icon.
 */
export async function unreadCounts(userId: string): Promise<{ messages: number; notifications: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { notificationPrefs: true } });
  const hidden = hiddenInAppTypes(parseNotificationPrefs(user?.notificationPrefs));
  const [messages, notifications] = await Promise.all([
    prisma.message.count({
      where: {
        conversation: { participants: { some: { userId } } },
        senderId: { not: userId },
        readAt: null,
      },
    }),
    prisma.notification.count({
      where: { userId, readAt: null, ...(hidden.length ? { type: { notIn: hidden } } : {}) },
    }),
  ]);
  return { messages, notifications };
}

export async function unreadBadgeCount(userId: string): Promise<number> {
  const { messages, notifications } = await unreadCounts(userId);
  return messages + notifications;
}
