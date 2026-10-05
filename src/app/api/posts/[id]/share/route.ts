import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Toggles the current user's share of a post into their own feed. Sharing a
 * post that's itself a share re-points at that share's own original, so a
 * share is never chained — there's always exactly one original underneath.
 * An optional `message` becomes the share's own caption, shown above the
 * embedded original (see Post.contentText on a row with sharedFromId set).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : null;

  const { id } = await params;

  const target = await prisma.post.findUnique({ where: { id }, select: { id: true, sharedFromId: true } });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const originalId = target.sharedFromId ?? target.id;
  const original = await prisma.post.findUnique({
    where: { id: originalId },
    select: { id: true, type: true, userId: true, user: { select: { allowPostShares: true } } },
  });
  if (!original) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.post.findUnique({
    where: { userId_sharedFromId: { userId: session.user.id, sharedFromId: originalId } },
  });

  if (existing) {
    await prisma.post.delete({ where: { id: existing.id } });
  } else {
    if (!original.user.allowPostShares) {
      return NextResponse.json({ error: "This person has turned off sharing for their posts" }, { status: 403 });
    }
    await prisma.post.create({
      data: {
        userId: session.user.id,
        type: original.type,
        sharedToFeed: true,
        sharedFromId: originalId,
        contentText: message || null,
      },
    });
    if (original.userId !== session.user.id) {
      await prisma.notification.create({
        data: { userId: original.userId, actorId: session.user.id, type: "POST_SHARE", postId: originalId },
      });
    }
  }

  const count = await prisma.post.count({ where: { sharedFromId: originalId } });

  return NextResponse.json({ shared: !existing, count });
}
