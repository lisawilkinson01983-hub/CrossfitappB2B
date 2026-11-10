import { prisma } from "@/lib/prisma";
import { getSiteAccountId } from "@/lib/siteAccount";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reminds everyone taking part in an event once, during the 24 hours before
 * it starts (EVENT_REMINDER, which also goes out as a push). Run every 30
 * minutes by the scheduler in src/instrumentation.ts; safe to run as often
 * as you like, since anyone already reminded about an event is skipped —
 * including people who join late, who get theirs on the next run.
 */
export async function sendEventReminders(now = new Date()): Promise<number> {
  const events = await prisma.event.findMany({
    where: { status: "APPROVED", date: { gt: now, lte: new Date(now.getTime() + DAY_MS) } },
    select: {
      id: true,
      createdById: true,
      participants: { select: { userId: true } },
      notifications: { where: { type: "EVENT_REMINDER" }, select: { userId: true } },
    },
  });
  if (events.length === 0) return 0;

  const siteAccountId = await getSiteAccountId();
  let sent = 0;
  for (const event of events) {
    const reminded = new Set(event.notifications.map((n) => n.userId));
    const due = [...new Set(event.participants.map((p) => p.userId))].filter((userId) => !reminded.has(userId));
    if (due.length === 0) continue;
    await prisma.notification.createMany({
      data: due.map((userId) => ({
        userId,
        actorId: siteAccountId ?? event.createdById,
        type: "EVENT_REMINDER" as const,
        eventId: event.id,
      })),
    });
    sent += due.length;
  }
  return sent;
}
