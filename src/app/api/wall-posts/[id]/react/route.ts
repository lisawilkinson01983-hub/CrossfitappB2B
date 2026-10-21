import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reactionSchema } from "@/lib/validation";

/** Toggles an emoji reaction on a wall post itself — same shape as /api/posts/[id]/react. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: wallPostId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { emoji } = parsed.data;

  const post = await prisma.wallPost.findUnique({ where: { id: wallPostId } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.wallPostReaction.findUnique({
    where: { userId_wallPostId_emoji: { userId: session.user.id, wallPostId, emoji } },
  });

  if (existing) {
    await prisma.wallPostReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.wallPostReaction.create({ data: { userId: session.user.id, wallPostId, emoji } });
    if (post.authorId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: post.authorId,
          actorId: session.user.id,
          type: "WALL_POST_REACTION",
          wallPostId,
          emoji,
        },
      });
    }
  }

  const reactions = await prisma.wallPostReaction.groupBy({
    by: ["emoji"],
    where: { wallPostId },
    _count: { emoji: true },
  });

  return NextResponse.json({
    emoji,
    reacted: !existing,
    reactions: reactions.map((r) => ({ emoji: r.emoji, count: r._count.emoji })),
  });
}
