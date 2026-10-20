import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addToConversation } from "@/lib/conversations";

/**
 * Approves a pending TeamJoinRequest — who's allowed depends on its kind:
 * an INVITE is approved by the person who'd be joining (request.userId); a
 * REQUEST is approved by the team's creator. Either way this is the one
 * place a TeamMember row actually gets created, so it's also where the
 * subject gets marked as an event participant (if they weren't already) and
 * synced into the team's own group chat (if one exists yet).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const viewerId = session.user.id;

  const { id } = await params;

  const request = await prisma.teamJoinRequest.findUnique({
    where: { id },
    include: { team: true },
  });
  if (!request || request.status !== "PENDING") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAuthorized = request.kind === "INVITE" ? request.userId === viewerId : request.team.createdById === viewerId;
  if (!isAuthorized) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { teamId, userId: subjectId, eventId } = { teamId: request.teamId, userId: request.userId, eventId: request.team.eventId };

  const existingMembers = await prisma.teamMember.findMany({
    where: { teamId, userId: { notIn: [subjectId, viewerId] } },
    select: { userId: true },
  });

  await prisma.$transaction([
    prisma.teamJoinRequest.update({ where: { id }, data: { status: "ACCEPTED" } }),
    prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId: subjectId } },
      create: { teamId, userId: subjectId },
      update: {},
    }),
  ]);

  // Being on a team means you're competing — mark them participating if
  // joining a team is the first thing that's happened for them on this
  // event, same as every other way of ending up on the roster.
  const existingParticipant = await prisma.eventParticipant.findUnique({
    where: { userId_eventId: { userId: subjectId, eventId } },
  });
  if (!existingParticipant) {
    await prisma.eventParticipant.create({ data: { userId: subjectId, eventId } });
    await prisma.eventInterest.deleteMany({ where: { userId: subjectId, eventId } });
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { attendeesConversationId: true } });
    if (event?.attendeesConversationId) {
      await addToConversation(event.attendeesConversationId, [subjectId]);
    }
  }

  if (request.team.conversationId) {
    await addToConversation(request.team.conversationId, [subjectId]);
  }

  if (existingMembers.length > 0) {
    await prisma.notification.createMany({
      data: existingMembers.map((m) => ({
        userId: m.userId,
        actorId: subjectId,
        type: "EVENT_TEAM_JOINED" as const,
        eventId,
      })),
    });
  }

  // Only a REQUEST needs a confirmation sent back — an INVITE's approver IS
  // the subject, so they already know; a REQUEST's approver is the team's
  // creator, acting on someone else's behalf, who should hear it worked.
  if (request.kind === "REQUEST") {
    await prisma.notification.create({
      data: { userId: subjectId, actorId: viewerId, type: "TEAM_JOIN_APPROVED", eventId },
    });
  }

  return NextResponse.json({ ok: true });
}
