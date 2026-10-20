import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertEventVisible } from "@/lib/eventVisibility";

/**
 * Already-named teams for this event, with their current roster — read by
 * the "I'm participating" prompt (see EventEngagementButtons) so someone
 * joining after their team's first member can add themselves to it instead
 * of only ever being offered "create a new team."
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: eventId } = await params;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || !(await assertEventVisible(event, session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const teams = await prisma.team.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    include: { members: { include: { user: { select: { id: true, name: true, photo: true } } } } },
  });

  // My own pending request/invite per team, if any — lets the UI tell
  // "request to join" apart from "you've already been invited, go respond
  // to it" instead of offering a redundant second request for the same pair.
  const myRequests = await prisma.teamJoinRequest.findMany({
    where: { teamId: { in: teams.map((t) => t.id) }, userId: session.user.id, status: "PENDING" },
    select: { teamId: true, kind: true },
  });
  const myRequestByTeamId = new Map(myRequests.map((r) => [r.teamId, r.kind]));

  return NextResponse.json({
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      members: team.members.map((m) => m.user),
      freeformNames: team.freeformMemberNames ? (JSON.parse(team.freeformMemberNames) as string[]) : [],
      joinedByMe: team.members.some((m) => m.userId === session.user.id),
      createdByMe: team.createdById === session.user.id,
      myPendingRequestKind: myRequestByTeamId.get(team.id) ?? null,
    })),
  });
}
