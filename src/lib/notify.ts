import { prisma } from "@/lib/prisma";
import { extractMentionIds } from "@/lib/mentions";

/**
 * Notifies every user @mentioned in a post or comment's text, skipping the
 * author and anyone in skipUserIds (e.g. someone already notified as the
 * reply/comment recipient, to avoid a duplicate notification for one action).
 * Mentioned IDs that aren't a real user (hand-crafted token, deleted account)
 * are silently ignored.
 */
export async function notifyMentions({
  text,
  actorId,
  postId,
  commentId,
  skipUserIds = [],
}: {
  text: string | null | undefined;
  actorId: string;
  postId: string;
  commentId?: string;
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
      postId,
      commentId: commentId ?? null,
    })),
  });
}
