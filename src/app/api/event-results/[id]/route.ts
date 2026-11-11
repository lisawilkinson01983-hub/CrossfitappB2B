import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Deletes a logged result — scoped to the caller's own row, even on a team
 * result (every member has their own independent EventResult row sharing
 * the team's placement data, same as how accepting a teammate tag creates
 * its own row rather than editing anyone else's) — OR, as a narrow override,
 * to a *different* person's solo result (no teamId of its own) sitting at
 * the exact place a team the caller created already holds for that event.
 * That's the one case someone else's leftover individual claim needs
 * clearing up (e.g. logged before they were added to the team), and it's
 * checked fresh against the database each time rather than trusted from
 * the client. Cascades to any feed post made from it (see
 * Post.linkedEventResultId's onDelete: Cascade).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const result = await prisma.eventResult.findUnique({
    where: { id },
    select: { userId: true, eventId: true, teamId: true, place: true },
  });
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (result.userId !== session.user.id) {
    const holdsConflictingTeamPlace =
      result.teamId == null &&
      result.place != null &&
      (await prisma.eventResult.findFirst({
        where: {
          eventId: result.eventId,
          place: result.place,
          teamId: { not: null },
          team: { createdById: session.user.id },
        },
        select: { id: true },
      })) != null;

    if (!holdsConflictingTeamPlace) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.eventResult.delete({ where: { id } });
    await prisma.notification.create({
      data: {
        userId: result.userId,
        actorId: session.user.id,
        type: "RESULT_REMOVED_BY_CAPTAIN",
        eventId: result.eventId,
      },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.eventResult.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
