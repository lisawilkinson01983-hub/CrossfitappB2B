import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reactionSchema } from "@/lib/validation";

/** Toggles an emoji reaction on a post — same shape as /api/comments/[id]/react, but for the post itself rather than a comment on it. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: postId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { emoji } = parsed.data;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.postReaction.findUnique({
    where: { userId_postId_emoji: { userId: session.user.id, postId, emoji } },
  });

  if (existing) {
    await prisma.postReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.postReaction.create({ data: { userId: session.user.id, postId, emoji } });
    if (post.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: post.userId,
          actorId: session.user.id,
          type: "POST_REACTION",
          postId,
          emoji,
        },
      });
    }
  }

  const reactions = await prisma.postReaction.groupBy({
    by: ["emoji"],
    where: { postId },
    _count: { emoji: true },
  });

  return NextResponse.json({
    emoji,
    reacted: !existing,
    reactions: reactions.map((r) => ({ emoji: r.emoji, count: r._count.emoji })),
  });
}
