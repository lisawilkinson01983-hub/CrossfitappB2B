import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertEventVisible } from "@/lib/eventVisibility";
import { addToConversation } from "@/lib/conversations";

/**
 * Asks to join a team found by browsing an event's Teams page — the team's
 * creator approves or declines it (see /api/team-join-requests/[id]/accept).
 * Different entry point from TeamTagPrompt's "already on one of these
 * teams" picker (that one goes through POST /api/events/[id]/participate
 * instead, bundled with the "I'm participating" click itself), but the same
 * underlying request/approve mechanism either way.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id: teamId } = await params;

  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { event: true } });
  if (!team || !(await assertEventVisible(team.event, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (team.createdById === userId) {
    return NextResponse.json({ error: "You created this team" }, { status: 400 });
  }
  const alreadyMember = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (alreadyMember) {
    return NextResponse.json({ error: "You're already on this team" }, { status: 400 });
  }
  const existingPending = await prisma.teamJoinRequest.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  // An existing PENDING row already covers this pair either way — if it's
  // an INVITE, the team already asked them (see TEAM_INVITE), and the right
  // move is accepting that, not layering a second REQUEST over it.
  if (existingPending?.status === "PENDING") {
    return NextResponse.json({ error: "A request for this team is already pending" }, { status: 400 });
  }

  await prisma.teamJoinRequest.upsert({
    where: { teamId_userId: { teamId, userId } },
    create: { teamId, userId, kind: "REQUEST", status: "PENDING", requestedById: userId },
    update: { kind: "REQUEST", status: "PENDING", requestedById: userId },
  });

  await prisma.notification.create({
    data: { userId: team.createdById, actorId: userId, type: "TEAM_JOIN_REQUEST", eventId: team.eventId },
  });

  // Requesting to join a team for a comp is as good as saying you're in it —
  // same auto-join as every other "I'm involved with this event now" path.
  const existingParticipant = await prisma.eventParticipant.findUnique({
    where: { userId_eventId: { userId, eventId: team.eventId } },
  });
  if (!existingParticipant) {
    await prisma.eventParticipant.create({ data: { userId, eventId: team.eventId } });
    await prisma.eventInterest.deleteMany({ where: { userId, eventId: team.eventId } });
    if (team.event.attendeesConversationId) {
      await addToConversation(team.event.attendeesConversationId, [userId]);
    }
  }

  return NextResponse.json({ ok: true });
}
