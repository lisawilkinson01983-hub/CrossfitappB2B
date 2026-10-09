import { prisma } from "@/lib/prisma";
import { extractMentionIds } from "@/lib/mentions";

/**
 * Notifies every user @mentioned in a piece of text, skipping the author and
 * anyone in skipUserIds (e.g. someone already notified as the reply/comment
 * recipient, to avoid a duplicate notification for one action). Mentioned IDs
 * that aren't a real user (hand-crafted token, deleted account) are silently
 * ignored. Exactly one of postId/eventId/workoutId/pbField should be passed,
 * matching whichever surface the text came from (post/comment, event notice,
 * workout comment, PB comment) — same minimal deep-link fields Notification
 * already uses for that surface's own comment-notification type.
 */
export async function notifyMentions({
  text,
  actorId,
  postId,
  commentId,
  eventId,
  workoutId,
  pbField,
  skipUserIds = [],
}: {
  text: string | null | undefined;
  actorId: string;
  postId?: string;
  commentId?: string;
  eventId?: string;
  workoutId?: string;
  pbField?: string;
  skipUserIds?: string[];
}): Promise<void> {
  const candidateIds = extractMentionIds(text).filter(
    (id) => id !== actorId && !skipUserIds.includes(id)
  );
  if (candidateIds.length === 0) return;

  const validUsers = await prisma.user.findMany({
    where: { id: { in: candidateIds } },
    select: { id: true },
  });
  if (validUsers.length === 0) return;

  await prisma.notification.createMany({
    data: validUsers.map(({ id: userId }) => ({
      userId,
      actorId,
      type: "MENTION" as const,
      postId: postId ?? null,
      commentId: commentId ?? null,
      eventId: eventId ?? null,
      workoutId: workoutId ?? null,
      pbField: pbField ?? null,
    })),
  });
}
