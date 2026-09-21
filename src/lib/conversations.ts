import { prisma } from "./prisma";

/** Always orders two user ids the same way, so (A,B) and (B,A) resolve to one conversation row. */
export function canonicalPair(userIdA: string, userIdB: string): [string, string] {
  return userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
}

export async function getOrCreateConversation(userIdA: string, userIdB: string) {
  const [userOneId, userTwoId] = canonicalPair(userIdA, userIdB);

  return prisma.conversation.upsert({
    where: { userOneId_userTwoId: { userOneId, userTwoId } },
    create: { userOneId, userTwoId },
    update: {},
  });
}
