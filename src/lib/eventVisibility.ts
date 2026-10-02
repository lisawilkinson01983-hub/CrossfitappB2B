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

/**
 * Prisma where-fragment for a browse/search listing (Discover, search-suggest)
 * — AND this in alongside other filters. A private event never appears here,
 * even for its creator or someone invited to or already participating in it
 * — those are found via My Events or a direct link instead (see
 * assertEventVisible above for actually opening one).
 */
export function eventVisibilityWhere(_userId: string): Prisma.EventWhereInput {
  return { isPrivate: false, status: "APPROVED" };
}
