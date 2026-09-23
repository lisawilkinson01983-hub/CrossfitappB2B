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

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.eventInterest.findUnique({
    where: { userId_eventId: { userId: session.user.id, eventId } },
  });

  if (existing) {
    await prisma.eventInterest.delete({ where: { id: existing.id } });
    if (existing.noticeId) {
      await prisma.eventNotice.delete({ where: { id: existing.noticeId } }).catch(() => {});
    }
    return NextResponse.json({ interested: false });
  }

  const notice = await prisma.eventNotice.create({
    data: { eventId, userId: session.user.id, text: `I'm looking for a team for ${event.name}!` },
  });
  await prisma.eventInterest.create({
    data: { userId: session.user.id, eventId, noticeId: notice.id },
  });

  return NextResponse.json({ interested: true });
}
