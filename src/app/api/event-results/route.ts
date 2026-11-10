import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ordinal } from "@/lib/eventResults";

const MAX_NOTE_LENGTH = 280;
const MAX_TAGGED = 20;

/**
 * Logs a result from the post-event prompt — either a solo/untracked-
 * partner result (one row, for the submitter, plus pending teammate tags)
 * or a registered-team result (one row per TeamMember, all sharing the
 * same placement data). Returns the submitter's own result id, which the
 * share-confirm step needs for POST /api/event-results/[id]/share.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  const eventId = typeof body?.eventId === "string" ? body.eventId : "";
  const placementType = body?.placementType === "EXACT" ? "EXACT" : body?.placementType === "COMPLETED" ? "COMPLETED" : "";
  const place = placementType === "EXACT" && Number.isInteger(body?.place) && body.place > 0 ? body.place : null;
  const totalCompetitors =
    placementType === "EXACT" && Number.isInteger(body?.totalCompetitors) && body.totalCompetitors > 0
      ? body.totalCompetitors
      : null;
  const division = typeof body?.division === "string" && body.division.trim() ? body.division.trim().slice(0, 40) : null;
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, MAX_NOTE_LENGTH) : null;
  const teamId = typeof body?.teamId === "string" ? body.teamId : null;
  const taggedUserIds: string[] = Array.isArray(body?.taggedUserIds)
    ? Array.from(
        new Set<string>(body.taggedUserIds.filter((id: unknown): id is string => typeof id === "string" && id !== userId))
      ).slice(0, MAX_TAGGED)
    : [];
  const freeformNames: string[] = Array.isArray(body?.freeformNames)
    ? body.freeformNames
        .filter((n: unknown): n is string => typeof n === "string" && n.trim().length > 0)
        .map((n: string) => n.trim().slice(0, 60))
        .slice(0, MAX_TAGGED)
    : [];

  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  if (placementType === "") return NextResponse.json({ error: "Missing placementType" }, { status: 400 });

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  // Only one team or individual can hold a given exact placement for this
  // event — a second, unrelated claim to e.g. "11th" is almost always a
  // mistake (wrong number typed, or someone logging solo before joining
  // the team that already claimed it) rather than a real tie. A row that's
  // already part of THIS SAME team doesn't conflict — that's just the rest
  // of the roster sharing the one placement they actually earned together.
  if (place != null) {
    const clashes = await prisma.eventResult.findMany({
      where: { eventId, place, placementType: "EXACT" },
      select: {
        userId: true,
        teamId: true,
        user: { select: { name: true } },
        team: { select: { name: true } },
      },
    });
    const conflict = clashes.find((r) => (teamId ? r.teamId !== teamId : r.userId !== userId));
    if (conflict) {
      const claimant = conflict.team?.name ?? conflict.user.name;
      return NextResponse.json(
        { error: `${ordinal(place)} place is already logged for this event by ${claimant}. Double-check your placement, or ask them about it if that's a mistake.` },
        { status: 409 }
      );
    }
  }

  if (teamId) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, eventId: true, members: { select: { userId: true } } },
    });
    if (!team || team.eventId !== eventId || !team.members.some((m) => m.userId === userId)) {
      return NextResponse.json({ error: "Not a member of that team" }, { status: 403 });
    }

    // SQLite's createMany has no skipDuplicates — upsert each member's row
    // instead (team rosters are small, so this stays cheap).
    await Promise.all(
      team.members.map((m) =>
        prisma.eventResult.upsert({
          where: { eventId_userId: { eventId, userId: m.userId } },
          create: {
            eventId,
            userId: m.userId,
            teamId,
            placementType,
            place,
            totalCompetitors,
            division,
            note,
            loggedByUserId: userId,
          },
          update: { teamId, placementType, place, totalCompetitors, division, note },
        })
      )
    );

    const mine = await prisma.eventResult.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { id: true },
    });
    return NextResponse.json({ resultId: mine?.id ?? null });
  }

  const result = await prisma.eventResult.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: {
      eventId,
      userId,
      placementType,
      place,
      totalCompetitors,
      division,
      note,
      loggedByUserId: userId,
      freeformTeammateNames: freeformNames.length > 0 ? JSON.stringify(freeformNames) : null,
    },
    update: {
      placementType,
      place,
      totalCompetitors,
      division,
      note,
      freeformTeammateNames: freeformNames.length > 0 ? JSON.stringify(freeformNames) : null,
    },
  });

  for (const taggedUserId of taggedUserIds) {
    const tag = await prisma.eventResultTag.upsert({
      where: { resultId_taggedUserId: { resultId: result.id, taggedUserId } },
      create: { resultId: result.id, taggedUserId },
      update: {},
    });
    await prisma.notification.create({
      data: {
        userId: taggedUserId,
        actorId: userId,
        type: "RESULT_TAG_REQUEST",
        eventId,
        eventResultTagId: tag.id,
      },
    });
  }

  return NextResponse.json({ resultId: result.id });
}
