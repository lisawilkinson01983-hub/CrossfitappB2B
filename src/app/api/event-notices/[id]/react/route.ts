import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reactionSchema } from "@/lib/validation";

/** Toggles an emoji reaction on an event notice (message board post) — same shape as /api/posts/[id]/react. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: noticeId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { emoji } = parsed.data;

  const notice = await prisma.eventNotice.findUnique({ where: { id: noticeId } });
  if (!notice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.eventNoticeReaction.findUnique({
    where: { userId_noticeId_emoji: { userId: session.user.id, noticeId, emoji } },
  });

  if (existing) {
    await prisma.eventNoticeReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.eventNoticeReaction.create({ data: { userId: session.user.id, noticeId, emoji } });
    if (notice.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: notice.userId,
          actorId: session.user.id,
          type: "EVENT_NOTICE_REACTION",
          eventId: notice.eventId,
          emoji,
        },
      });
    }
  }

  const reactions = await prisma.eventNoticeReaction.groupBy({
    by: ["emoji"],
    where: { noticeId },
    _count: { emoji: true },
  });

  return NextResponse.json({
    emoji,
    reacted: !existing,
    reactions: reactions.map((r) => ({ emoji: r.emoji, count: r._count.emoji })),
  });
}
