import { prisma } from "@/lib/prisma";
import { resolveAudienceUserIds } from "@/lib/noticeAudience";

export type InviteAudience = {
  userIds?: string[];
  inviteFollowers?: boolean;
  inviteAffiliateGym?: string;
};

/**
 * Resolves an organizer's invite picks — individual athletes, "everyone who
 * follows me", and/or "everyone at gym X" (the two group-invite shapes a
 * private event needs: a social circle, or a whole affiliate) — into a
 * deduped list of user ids, excluding the organizer and anyone
 * deleted/suspended.
 */
export async function resolveInviteRecipientIds(organizerId: string, audience: InviteAudience): Promise<string[]> {
  const ids = new Set<string>();

  const explicitIds = (audience.userIds ?? []).filter((id) => id && id !== organizerId);
  if (explicitIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: explicitIds }, deletedAt: null, suspendedAt: null },
      select: { id: true },
    });
    users.forEach((u) => ids.add(u.id));
  }

  if (audience.inviteFollowers) {
    const followers = await prisma.follow.findMany({
      where: { followingId: organizerId, follower: { deletedAt: null, suspendedAt: null } },
      select: { followerId: true },
    });
    followers.forEach((f) => ids.add(f.followerId));
  }

  if (audience.inviteAffiliateGym) {
    const gymUserIds = await resolveAudienceUserIds({ affiliateGym: audience.inviteAffiliateGym }, organizerId);
    gymUserIds.forEach((id) => ids.add(id));
  }

  ids.delete(organizerId);
  return Array.from(ids);
}

/** Creates EventInvite rows plus the matching EVENT_INVITE notifications — idempotent against re-inviting the same person (no duplicate invite row or notification). */
export async function createEventInvites(eventId: string, invitedById: string, recipientIds: string[]): Promise<void> {
  if (recipientIds.length === 0) return;

  const existing = await prisma.eventInvite.findMany({
    where: { eventId, userId: { in: recipientIds } },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((e) => e.userId));
  const newIds = recipientIds.filter((id) => !existingIds.has(id));
  if (newIds.length === 0) return;

  await prisma.eventInvite.createMany({
    data: newIds.map((userId) => ({ eventId, userId, invitedById })),
  });

  await prisma.notification.createMany({
    data: newIds.map((userId) => ({
      userId,
      actorId: invitedById,
      type: "EVENT_INVITE" as const,
      eventId,
    })),
  });
}
