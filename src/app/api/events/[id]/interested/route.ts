import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertEventVisible } from "@/lib/eventVisibility";

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

    const notice = await prisma.eventNotice.create({
      data: { eventId, userId, text: `I'm looking for a team for ${event.name}!` },
    });
    await prisma.eventInterest.create({ data: { userId, eventId, noticeId: notice.id } });
  }

  const [participantRow, interestRow] = await Promise.all([
    prisma.eventParticipant.findUnique({ where: { userId_eventId: { userId, eventId } } }),
    prisma.eventInterest.findUnique({ where: { userId_eventId: { userId, eventId } } }),
  ]);

  return NextResponse.json({ participating: !!participantRow, interested: !!interestRow });
}
