import { prisma } from "@/lib/prisma";
import { addToConversation } from "@/lib/conversations";

/**
 * Makes `userId` a real member of `teamId` — the one place a TeamMember row
 * actually gets created, shared by both accepting a pending TeamJoinRequest
 * (see /api/team-join-requests/[id]/accept) and someone who was tagged by
 * freeform name (not on the app yet) signing up through their own team
 * invite link (see /api/signup, TeamInviteLink). Marks them as an event
 * participant if they weren't already, syncs them into the team's own group
 * chat (if one exists), and lets existing members know.
 */
export async function addUserToTeam(
  teamId: string,
  userId: string,
  // Skips notifying whoever just performed this action on the new member's
  // behalf (a team creator approving someone else's join request) — they
  // don't need a "so-and-so joined your team" notice about their own click.
  options?: { excludeFromNotification?: string }
) {
  const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } });

  const excludedIds = [userId, options?.excludeFromNotification].filter((v): v is string => !!v);
  const existingMembers = await prisma.teamMember.findMany({
    where: { teamId, userId: { notIn: excludedIds } },
    select: { userId: true },
  });

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId, userId } },
    create: { teamId, userId },
    update: {},
  });

  const existingParticipant = await prisma.eventParticipant.findUnique({
    where: { userId_eventId: { userId, eventId: team.eventId } },
  });
  if (!existingParticipant) {
    await prisma.eventParticipant.create({ data: { userId, eventId: team.eventId } });
    await prisma.eventInterest.deleteMany({ where: { userId, eventId: team.eventId } });
    const event = await prisma.event.findUnique({
      where: { id: team.eventId },
      select: { attendeesConversationId: true },
    });
    if (event?.attendeesConversationId) {
      await addToConversation(event.attendeesConversationId, [userId]);
    }
  }

  if (team.conversationId) {
    await addToConversation(team.conversationId, [userId]);
  }

  if (existingMembers.length > 0) {
    await prisma.notification.createMany({
      data: existingMembers.map((m) => ({
        userId: m.userId,
        actorId: userId,
        type: "EVENT_TEAM_JOINED" as const,
        eventId: team.eventId,
      })),
    });
  }
}
