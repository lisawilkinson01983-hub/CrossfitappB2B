import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reactionSchema } from "@/lib/validation";

/** Toggles one of the fixed REACTION_EMOJIS on a notice-board comment — same shape as /api/comments/[id]/react. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: commentId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { emoji } = parsed.data;

  const comment = await prisma.eventNoticeComment.findUnique({
    where: { id: commentId },
    include: { notice: { select: { eventId: true } } },
  });
  if (!comment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.eventNoticeCommentReaction.findUnique({
    where: { userId_commentId_emoji: { userId: session.user.id, commentId, emoji } },
  });

  if (existing) {
    await prisma.eventNoticeCommentReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.eventNoticeCommentReaction.create({ data: { userId: session.user.id, commentId, emoji } });
    if (comment.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: comment.userId,
          actorId: session.user.id,
          type: "EVENT_NOTICE_COMMENT_REACTION",
          eventId: comment.notice.eventId,
          emoji,
        },
      });
    }
  }

  const reactions = await prisma.eventNoticeCommentReaction.groupBy({
    by: ["emoji"],
    where: { commentId },
    _count: { emoji: true },
  });

  return NextResponse.json({
    emoji,
    reacted: !existing,
    reactions: reactions.map((r) => ({ emoji: r.emoji, count: r._count.emoji })),
  });
}
