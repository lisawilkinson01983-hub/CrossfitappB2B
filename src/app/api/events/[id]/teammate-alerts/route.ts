import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { teammateAlertSchema } from "@/lib/validation";
import { parseTeammateRequests } from "@/lib/labels";
import { teammateCriteriaMatch } from "@/lib/teammateMatch";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: eventId } = await params;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = teammateAlertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.eventTeammateAlert.findUnique({
    where: {
      eventId_userId_gender_division: {
        eventId,
        userId: session.user.id,
        gender: parsed.data.gender,
        division: parsed.data.division,
      },
    },
  });
  if (existing) {
    return NextResponse.json({ alert: existing, matchedCount: 0, alreadySaved: true });
  }

  const alert = await prisma.eventTeammateAlert.create({
    data: {
      eventId,
      userId: session.user.id,
      gender: parsed.data.gender,
      division: parsed.data.division,
    },
  });

  // Reverse direction: notify any team whose existing request already fits
  // this alert, so they hear about a suitable athlete right away rather than
  // waiting for someone to search again after they'd already posted.
  const notices = await prisma.eventNotice.findMany({
    where: { eventId, userId: { not: session.user.id }, teammateRequests: { not: null } },
    select: { userId: true, teammateRequests: true },
  });

  const matchedAuthorIds = new Set<string>();
  for (const notice of notices) {
    const requests = parseTeammateRequests(notice.teammateRequests);
    if (requests.some((req) => teammateCriteriaMatch(alert, req))) {
      matchedAuthorIds.add(notice.userId);
    }
  }

  if (matchedAuthorIds.size > 0) {
    await prisma.notification.createMany({
      data: [...matchedAuthorIds].map((userId) => ({
        userId,
        actorId: session.user.id,
        type: "TEAMMATE_SEARCH_MATCH" as const,
        eventId,
      })),
    });
  }

  return NextResponse.json({ alert, matchedCount: matchedAuthorIds.size, alreadySaved: false });
}
