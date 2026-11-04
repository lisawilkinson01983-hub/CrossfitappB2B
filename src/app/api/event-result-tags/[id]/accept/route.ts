import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** "Yes, add to my profile" — clones the tagger's result onto the tagged user's own profile. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const tag = await prisma.eventResultTag.findUnique({
    where: { id },
    include: {
      result: {
        select: { eventId: true, placementType: true, place: true, totalCompetitors: true, division: true, note: true, loggedByUserId: true },
      },
    },
  });
  if (!tag) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (tag.taggedUserId !== session.user.id) {
    return NextResponse.json({ error: "Not your tag" }, { status: 403 });
  }

  if (tag.status === "PENDING") {
    await prisma.$transaction([
      prisma.eventResult.upsert({
        where: { eventId_userId: { eventId: tag.result.eventId, userId: session.user.id } },
        create: {
          eventId: tag.result.eventId,
          userId: session.user.id,
          placementType: tag.result.placementType,
          place: tag.result.place,
          totalCompetitors: tag.result.totalCompetitors,
          division: tag.result.division,
          note: tag.result.note,
          loggedByUserId: tag.result.loggedByUserId,
        },
        update: {},
      }),
      prisma.eventResultTag.update({ where: { id }, data: { status: "ACCEPTED" } }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
