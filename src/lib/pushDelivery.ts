import { prisma } from "@/lib/prisma";
import { notificationHref, notificationText } from "@/lib/notifications";
import { pushConfigured, sendPushToUser, type PushMessage } from "@/lib/push";

/**
 * Turns new in-app notifications and direct messages into phone pushes.
 * Triggered from the Prisma client (src/lib/prisma.ts) whenever a
 * Notification or Message row is created, so every route that already
 * creates one gets a push for free.
 *
 * Each row is claimed (pushedAt set) before sending, so overlapping runs
 * never double-send. Only rows from the last few minutes are considered —
 * a deploy or restart never backfills a pile of stale pushes.
 */

const WINDOW_MS = 10 * 60 * 1000;

export async function deliverPendingPushes(): Promise<void> {
  if (!pushConfigured()) return;
  const since = new Date(Date.now() - WINDOW_MS);
  await Promise.all([deliverNotifications(since), deliverMessages(since)]);
}

async function claim(model: "notification" | "message", id: string): Promise<boolean> {
  const { count } =
    model === "notification"
      ? await prisma.notification.updateMany({ where: { id, pushedAt: null }, data: { pushedAt: new Date() } })
      : await prisma.message.updateMany({ where: { id, pushedAt: null }, data: { pushedAt: new Date() } });
  return count === 1;
}

async function deliverNotifications(since: Date) {
  const pending = await prisma.notification.findMany({
    where: {
      pushedAt: null,
      readAt: null,
      createdAt: { gte: since },
      user: { pushDevices: { some: {} } },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    // Same shape the Notifications page renders, so the wording matches.
    include: {
      actor: { select: { id: true, name: true } },
      post: { select: { id: true, type: true, photo: true, video: true, media: { select: { kind: true } } } },
      comment: { select: { id: true } },
      event: { select: { id: true, name: true } },
      gym: { select: { id: true, name: true } },
      notice: { select: { title: true, body: true } },
      eventWorkout: { select: { eventId: true, number: true } },
    },
  });

  for (const n of pending) {
    if (!(await claim("notification", n.id))) continue;
    const message: PushMessage =
      n.type === "SYSTEM_ANNOUNCEMENT"
        ? { title: n.notice?.title || "Box 2 Box", body: n.notice?.body ?? "", url: "/notifications" }
        : { title: n.actor.name, body: capitalize(notificationText(n)), url: notificationHref(n, n.userId) };
    await sendPushToUser(n.userId, message);
  }
}

async function deliverMessages(since: Date) {
  const pending = await prisma.message.findMany({
    where: { pushedAt: null, deletedAt: null, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      sender: { select: { id: true, name: true } },
      conversation: { select: { id: true, isGroup: true, name: true, participants: { select: { userId: true } } } },
    },
  });

  for (const m of pending) {
    if (!(await claim("message", m.id))) continue;
    const recipients = m.conversation.participants.map((p) => p.userId).filter((id) => id !== m.senderId);
    if (recipients.length === 0) continue;

    // Someone who has blocked the sender never hears from them.
    const blockers = new Set(
      (
        await prisma.block.findMany({
          where: { blockerId: { in: recipients }, blockedId: m.senderId },
          select: { blockerId: true },
        })
      ).map((b) => b.blockerId)
    );

    const message: PushMessage = {
      title: m.conversation.isGroup ? `${m.sender.name} · ${m.conversation.name || "Group chat"}` : m.sender.name,
      body: messagePreview(m),
      url: `/messages/${m.conversation.id}`,
      threadId: m.conversation.id,
    };
    for (const userId of recipients) {
      if (!blockers.has(userId)) await sendPushToUser(userId, message);
    }
  }
}

function messagePreview(m: { text: string; photo: string | null; video: string | null; gifUrl: string | null }): string {
  const text = m.text.trim();
  if (text) return text.length > 140 ? `${text.slice(0, 139)}…` : text;
  if (m.video) return "🎥 Sent a video";
  if (m.photo) return "📷 Sent a photo";
  if (m.gifUrl) return "Sent a GIF";
  return "Sent a message";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
