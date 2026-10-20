import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addUserToTeam } from "@/lib/teams";

/**
 * Approves a pending TeamJoinRequest — who's allowed depends on its kind:
 * an INVITE is approved by the person who'd be joining (request.userId); a
 * REQUEST is approved by the team's creator. Either way, the actual
 * TeamMember-creation/participant/chat-sync/notify work is shared with the
 * freeform-invite-link signup path (see addUserToTeam).
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

  await prisma.teamJoinRequest.update({ where: { id }, data: { status: "ACCEPTED" } });
  await addUserToTeam(teamId, subjectId, { excludeFromNotification: viewerId });

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
