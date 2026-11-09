import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_TEAM_NAME_LENGTH = 60;

/**
 * Renames a team — creator only, same "whoever made it owns it" permission
 * as removing a roster spot (see POST .../remove-member). The team's own
 * group chat (if one exists) is kept in sync, same name either way, since
 * that's the one other place the name is actually stored rather than just
 * looked up live — everywhere else that shows it (My Teams, an event's
 * Teams page, the join/invite buttons) reads Team.name directly, so a
 * rename shows up there automatically.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, MAX_TEAM_NAME_LENGTH) : "";
  if (!name) {
    return NextResponse.json({ error: "Give your team a name" }, { status: 400 });
  }

  await prisma.team.update({ where: { id: teamId }, data: { name } });
  if (team.conversationId) {
    await prisma.conversation.update({ where: { id: team.conversationId }, data: { name } });
  }

  return NextResponse.json({ name });
}
