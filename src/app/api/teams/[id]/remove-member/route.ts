import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Removes someone from the roster — creator only. A platform member loses
 * their TeamMember row and their spot in the team's group chat (if one
 * exists), and gets notified so they're not just finding out by noticing
 * the roster changed; a freeform (no-account) name is just dropped from
 * freeformMemberNames, since there's nobody to tell. Doesn't touch
 * EventParticipant either way — being off this team doesn't mean they're
 * not still attending the event, same reasoning as leaving a Team row in
 * place for its remaining members instead of deleting it.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id: teamId } = await params;

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (team.createdById !== userId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const targetUserId = typeof body?.userId === "string" ? body.userId : null;
  const freeformName = typeof body?.freeformName === "string" ? body.freeformName : null;

  if (targetUserId) {
    if (targetUserId === team.createdById) {
      return NextResponse.json({ error: "Can't remove the team's creator" }, { status: 400 });
    }
    const member = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: targetUserId } } });
    if (!member) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId: targetUserId } } });

    if (team.conversationId) {
      await prisma.conversationParticipant
        .delete({ where: { conversationId_userId: { conversationId: team.conversationId, userId: targetUserId } } })
        .catch(() => null);
    }

    await prisma.notification.create({
      data: { userId: targetUserId, actorId: userId, type: "TEAM_MEMBER_REMOVED", eventId: team.eventId },
    });

    return NextResponse.json({ ok: true });
  }

  if (freeformName) {
    const existingNames: string[] = team.freeformMemberNames ? JSON.parse(team.freeformMemberNames) : [];
    const remaining = existingNames.filter((n) => n.toLowerCase() !== freeformName.toLowerCase());
    await prisma.team.update({
      where: { id: teamId },
      data: { freeformMemberNames: remaining.length > 0 ? JSON.stringify(remaining) : null },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nothing to remove" }, { status: 400 });
}
