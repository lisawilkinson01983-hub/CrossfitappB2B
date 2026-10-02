import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertEventVisible } from "@/lib/eventVisibility";
import { parseTeammateRequests, parseLevels } from "@/lib/labels";
import { teammateCriteriaMatch } from "@/lib/teammateMatch";

/**
 * Marking "I'm interested" is the one signal that someone's actually
 * available and looking for a team — "I'm participating" means they already
 * have one, so that path doesn't trigger this. Notifies the author of any
 * other open "looking for teammates" notice on this event whose gender/level
 * criteria this athlete fits, reusing the TEAMMATE_SEARCH_MATCH type that
 * /api/events/[id]/teammate-alerts already sends for its own (separate,
 * opt-in "notify me about future requests") match check.
 */
async function notifyMatchingTeammateRequests(eventId: string, interestedUserId: string) {
  const interestedUser = await prisma.user.findUnique({
    where: { id: interestedUserId },
    select: { gender: true, levels: true },
  });
  const athleteLevels = parseLevels(interestedUser?.levels ?? null);
  if (!interestedUser?.gender || athleteLevels.length === 0) return;

  const notices = await prisma.eventNotice.findMany({
    where: { eventId, userId: { not: interestedUserId }, teammateRequests: { not: null } },
    select: { userId: true, teammateRequests: true },
  });

  const matchedAuthorIds = new Set<string>();
  for (const notice of notices) {
    const requests = parseTeammateRequests(notice.teammateRequests);
    // An athlete competing across two levels fits a request matching either.
    const fits = requests.some((req) =>
      athleteLevels.some((division) => teammateCriteriaMatch({ gender: interestedUser.gender!, division }, req))
    );
    if (fits) matchedAuthorIds.add(notice.userId);
  }

  if (matchedAuthorIds.size > 0) {
    await prisma.notification.createMany({
      data: [...matchedAuthorIds].map((userId) => ({
        userId,
        actorId: interestedUserId,
        type: "TEAMMATE_SEARCH_MATCH" as const,
        eventId,
      })),
    });
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: eventId } = await params;
  const userId = session.user.id;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await assertEventVisible(event, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.eventInterest.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });

  if (existing) {
    await prisma.eventInterest.delete({ where: { id: existing.id } });
    if (existing.noticeId) {
      await prisma.eventNotice.delete({ where: { id: existing.noticeId } }).catch(() => {});
    }
  } else {
    // "I'm interested" and "I'm participating" are mutually exclusive —
    // marking interest after already joining un-joins the event first.
    const existingParticipant = await prisma.eventParticipant.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    if (existingParticipant) {
      await prisma.eventParticipant.delete({ where: { id: existingParticipant.id } });
      await prisma.post.deleteMany({ where: { userId, linkedEventId: eventId } });
    }

    // A private social meetup has no "team" to look for — skip the
    // auto-posted notice-board message that exists purely for teammate
    // matching on competitions (see isCompetitionEvent/eventKindLabel).
    const isPrivateSocial = event.isPrivate && event.eventKind === "SOCIAL";
    if (isPrivateSocial) {
      await prisma.eventInterest.create({ data: { userId, eventId } });
    } else {
      const notice = await prisma.eventNotice.create({
        data: { eventId, userId, text: `I'm looking for a team for ${event.name}!` },
      });
      await prisma.eventInterest.create({ data: { userId, eventId, noticeId: notice.id } });
      await notifyMatchingTeammateRequests(eventId, userId);
    }
  }

  const [participantRow, interestRow] = await Promise.all([
    prisma.eventParticipant.findUnique({ where: { userId_eventId: { userId, eventId } } }),
    prisma.eventInterest.findUnique({ where: { userId_eventId: { userId, eventId } } }),
  ]);

  return NextResponse.json({ participating: !!participantRow, interested: !!interestRow });
}
