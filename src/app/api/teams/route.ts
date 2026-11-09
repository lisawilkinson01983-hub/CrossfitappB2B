import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertEventVisible } from "@/lib/eventVisibility";
import { isCompetitionEvent } from "@/lib/labels";
import { addToConversation } from "@/lib/conversations";

const MAX_TEAMMATES = 20;
const MAX_TEAM_NAME_LENGTH = 60;

/**
 * Starts a new team for a competition from the My Teams tab — same
 * underlying shape as naming a team through the "I'm participating" prompt
 * (see POST /api/events/[id]/participate), just reachable without going
 * through that join flow first. The creator is marked participating and
 * added to the roster immediately; any platform teammate they tag gets a
 * PENDING TeamJoinRequest instead (see that model's own doc comment) — they
 * only show up on the roster once they approve it.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  const eventId = typeof body?.eventId === "string" ? body.eventId : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, MAX_TEAM_NAME_LENGTH) : "";

  const rawTeammateIds: unknown[] = Array.isArray(body?.teammateIds) ? body.teammateIds : [];
  const teammateIds: string[] = Array.from(
    new Set(rawTeammateIds.filter((id): id is string => typeof id === "string" && id !== userId))
  ).slice(0, MAX_TEAMMATES);

  const rawTeammateNames: unknown[] = Array.isArray(body?.teammateNames) ? body.teammateNames : [];
  const teammateNames: string[] = rawTeammateNames
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
    .map((n) => n.trim().slice(0, 60))
    .slice(0, MAX_TEAMMATES);

  if (!eventId) {
    return NextResponse.json({ error: "Select an event" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Give your team a name" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || !(await assertEventVisible(event, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isCompetitionEvent(event)) {
    return NextResponse.json({ error: "Teams are only for competitions" }, { status: 400 });
  }

  const teammates =
    teammateIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: teammateIds }, deletedAt: null }, select: { id: true, name: true } })
      : [];

  const team = await prisma.team.create({
    data: {
      eventId,
      createdById: userId,
      name,
      freeformMemberNames: teammateNames.length > 0 ? JSON.stringify(teammateNames) : null,
      members: { create: [{ userId }] },
    },
  });

  // Same "joining marks you participating" treatment as the join-flow
  // version of team creation — a team you've started for a comp means
  // you're in it, not just browsing.
  const existingParticipant = await prisma.eventParticipant.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });
  if (!existingParticipant) {
    await prisma.eventParticipant.create({ data: { userId, eventId } });
    await prisma.eventInterest.deleteMany({ where: { userId, eventId } });
    if (event.attendeesConversationId) {
      await addToConversation(event.attendeesConversationId, [userId]);
    }
  }

  if (teammates.length > 0) {
    await Promise.all(
      teammates.map((t) =>
        prisma.teamJoinRequest.upsert({
          where: { teamId_userId: { teamId: team.id, userId: t.id } },
          create: { teamId: team.id, userId: t.id, kind: "INVITE", status: "PENDING", requestedById: userId },
          update: { status: "PENDING", requestedById: userId },
        })
      )
    );
    await prisma.notification.createMany({
      data: teammates.map((t) => ({
        userId: t.id,
        actorId: userId,
        type: "TEAM_INVITE" as const,
        eventId,
      })),
    });
  }

  return NextResponse.json({ id: team.id });
}
