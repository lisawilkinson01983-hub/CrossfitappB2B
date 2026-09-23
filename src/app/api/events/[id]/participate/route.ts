import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const existing = await prisma.eventParticipant.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });

  if (existing) {
    await prisma.eventParticipant.delete({ where: { id: existing.id } });
    await prisma.post.deleteMany({ where: { userId, linkedEventId: eventId } });
  } else {
    // "I'm participating" and "I'm interested" are mutually exclusive — this
    // clears any active interest mark, but leaves its auto-generated notice
    // in place (it just picks up the "I'm in!" badge once this athlete shows
    // up in the participants list).
    const existingInterest = await prisma.eventInterest.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    if (existingInterest) {
      await prisma.eventInterest.delete({ where: { id: existingInterest.id } });
    }

    await prisma.eventParticipant.create({ data: { userId, eventId } });
    await prisma.post.create({
      data: { userId, type: "UPDATE", linkedEventId: eventId },
    });
  }

  const [participantRow, interestRow] = await Promise.all([
    prisma.eventParticipant.findUnique({ where: { userId_eventId: { userId, eventId } } }),
    prisma.eventInterest.findUnique({ where: { userId_eventId: { userId, eventId } } }),
  ]);

  return NextResponse.json({ participating: !!participantRow, interested: !!interestRow });
}
