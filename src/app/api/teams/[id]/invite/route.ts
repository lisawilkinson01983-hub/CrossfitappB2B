import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_TEAMMATES = 20;

/**
 * Invites more people onto an already-existing team — any current member
 * can do this, not just whoever created it (same permission as starting the
 * team's group chat). A platform teammate gets a PENDING TeamJoinRequest +
 * TEAM_INVITE notification, same as tagging someone while first creating
 * the team (see POST /api/teams); a name with no account just gets appended
 * to freeformMemberNames directly, since there's nobody there to approve
 * anything. Either way, someone who already has a pending request for this
 * team (an INVITE already waiting on them, or their own REQUEST waiting on
 * the creator) is left alone rather than layered over — same guard as
 * /api/teams/[id]/join-request's symmetric case.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const body = await req.json().catch(() => null);

  const rawTeammateIds: unknown[] = Array.isArray(body?.teammateIds) ? body.teammateIds : [];
  const candidateIds: string[] = Array.from(
    new Set(
      rawTeammateIds.filter(
        (id): id is string => typeof id === "string" && id !== userId && !team.members.some((m) => m.userId === id)
      )
    )
  ).slice(0, MAX_TEAMMATES);

  const rawTeammateNames: unknown[] = Array.isArray(body?.teammateNames) ? body.teammateNames : [];
  const newFreeformNames: string[] = rawTeammateNames
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
    .map((n) => n.trim().slice(0, 60))
    .slice(0, MAX_TEAMMATES);

  const candidates =
    candidateIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: candidateIds }, deletedAt: null }, select: { id: true } })
      : [];

  const existingPending = await prisma.teamJoinRequest.findMany({
    where: { teamId, userId: { in: candidates.map((c) => c.id) }, status: "PENDING" },
    select: { userId: true },
  });
  const alreadyPendingIds = new Set(existingPending.map((r) => r.userId));

  const invitedUserIds = candidates.filter((c) => !alreadyPendingIds.has(c.id)).map((c) => c.id);
  const skippedUserIds = candidates.filter((c) => alreadyPendingIds.has(c.id)).map((c) => c.id);

  if (invitedUserIds.length > 0) {
    await Promise.all(
      invitedUserIds.map((id) =>
        prisma.teamJoinRequest.upsert({
          where: { teamId_userId: { teamId, userId: id } },
          create: { teamId, userId: id, kind: "INVITE", status: "PENDING", requestedById: userId },
          update: { kind: "INVITE", status: "PENDING", requestedById: userId },
        })
      )
    );
    await prisma.notification.createMany({
      data: invitedUserIds.map((id) => ({
        userId: id,
        actorId: userId,
        type: "TEAM_INVITE" as const,
        eventId: team.eventId,
      })),
    });
  }

  let addedFreeformNames: string[] = [];
  // One per freeform name, so signing up through it (see POST /api/signup)
  // can turn that exact roster slot into a real membership instead of just
  // crediting a generic referral.
  let inviteLinks: { name: string; token: string }[] = [];
  if (newFreeformNames.length > 0) {
    const existingNames: string[] = team.freeformMemberNames ? JSON.parse(team.freeformMemberNames) : [];
    const existingLower = new Set(existingNames.map((n) => n.toLowerCase()));
    addedFreeformNames = newFreeformNames.filter((n) => !existingLower.has(n.toLowerCase()));
    if (addedFreeformNames.length > 0) {
      await prisma.team.update({
        where: { id: teamId },
        data: { freeformMemberNames: JSON.stringify([...existingNames, ...addedFreeformNames]) },
      });
      const createdLinks = await Promise.all(
        addedFreeformNames.map((name) =>
          prisma.teamInviteLink.create({
            data: { teamId, freeformName: name, createdById: userId },
            select: { id: true },
          })
        )
      );
      inviteLinks = addedFreeformNames.map((name, i) => ({ name, token: createdLinks[i].id }));
    }
  }

  return NextResponse.json({ invitedUserIds, skippedUserIds, addedFreeformNames, inviteLinks });
}
