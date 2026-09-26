import { prisma } from "./prisma";

/**
 * Finds (or creates) the 1:1 conversation between exactly these two users.
 * "Exactly these two" means a conversation with a third participant (or a
 * named group) never matches, even if both users are in it — that's what
 * createGroupConversation is for.
 */
export async function getOrCreateConversation(userIdA: string, userIdB: string) {
  const existing = await prisma.conversation.findFirst({
    where: {
      isGroup: false,
      AND: [
        { participants: { some: { userId: userIdA } } },
        { participants: { some: { userId: userIdB } } },
        { participants: { every: { userId: { in: [userIdA, userIdB] } } } },
      ],
    },
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      isGroup: false,
      participants: { create: [{ userId: userIdA }, { userId: userIdB }] },
    },
  });
}

/** Always creates a new group conversation — unlike getOrCreateConversation, there's no "the" group for a given set of people. */
export async function createGroupConversation(creatorId: string, otherUserIds: string[], name?: string) {
  const participantIds = Array.from(new Set([creatorId, ...otherUserIds]));
  return prisma.conversation.create({
    data: {
      isGroup: true,
      name: name?.trim() || null,
      participants: { create: participantIds.map((userId) => ({ userId })) },
    },
  });
}

/** The name shown for a conversation: its explicit group name, or else the other participants' names joined together. */
export function conversationDisplayName(
  conversation: { isGroup: boolean; name: string | null },
  otherParticipantNames: string[]
): string {
  if (conversation.name) return conversation.name;
  if (otherParticipantNames.length === 0) return "Deleted User";
  return otherParticipantNames.join(", ");
}
