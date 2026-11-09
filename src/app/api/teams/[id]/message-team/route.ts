import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createGroupConversation, addToConversation } from "@/lib/conversations";

/**
 * Gets (or starts) the team's own group chat — any current member can do
 * this, not just whoever created the team. Named after the team itself.
 * Re-syncs membership on every call (covering anyone who joined before the
 * chat existed), and from then on a newly-approved member is added
 * automatically by /api/team-join-requests/[id]/accept, same pattern as
 * Event.attendeesConversationId/message-attendees.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id: teamId } = await params;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: { select: { userId: true } } },
  });
  if (!team) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!team.members.some((m) => m.userId === userId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const memberIds = team.members.map((m) => m.userId).filter((id) => id !== userId);

  if (memberIds.length === 0) {
    return NextResponse.json({ error: "No other teammates to message yet" }, { status: 400 });
  }

  let conversationId = team.conversationId;

  if (conversationId) {
    await addToConversation(conversationId, memberIds);
  } else {
    const conversation = await createGroupConversation(userId, memberIds, team.name);
    conversationId = conversation.id;
    await prisma.team.update({ where: { id: teamId }, data: { conversationId } });
  }

  return NextResponse.json({ id: conversationId });
}
