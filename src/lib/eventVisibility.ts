import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Whether `userId` is allowed to see a private event: its creator/submitter,
 * anyone already participating, or anyone invited (see EventInvite) — an
 * invite grants visibility on its own, before the invitee decides to join.
 * A public (non-private) event is visible to everyone once approved.
 */
export async function assertEventVisible(
  event: { id: string; isPrivate: boolean; status: string; createdById: string; submittedById: string | null },
  userId: string
): Promise<boolean> {
  if (!event.isPrivate) return event.status === "APPROVED";
  if (event.createdById === userId || event.submittedById === userId) return true;

  const [participant, invite] = await Promise.all([
    prisma.eventParticipant.findUnique({ where: { userId_eventId: { userId, eventId: event.id } } }),
    prisma.eventInvite.findUnique({ where: { eventId_userId: { eventId: event.id, userId } } }),
  ]);
  return !!participant || !!invite;
}

/** Prisma where-fragment for any list of events (Discover, search) — AND this in alongside other filters. */
export function eventVisibilityWhere(userId: string): Prisma.EventWhereInput {
  return {
    OR: [
      { isPrivate: false, status: "APPROVED" },
      {
        isPrivate: true,
        OR: [
          { createdById: userId },
          { submittedById: userId },
          { participants: { some: { userId } } },
          { invites: { some: { userId } } },
        ],
      },
    ],
  };
}
