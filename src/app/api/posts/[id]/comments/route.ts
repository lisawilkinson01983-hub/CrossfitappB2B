import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commentSchema } from "@/lib/validation";
import { notifyMentions } from "@/lib/notify";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: postId } = await params;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const parentId = typeof body?.parentId === "string" ? body.parentId : null;
  let parentComment: { id: string; userId: string } | null = null;
  if (parentId) {
    parentComment = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { id: true, userId: true, postId: true },
    }).then((c) => (c && c.postId === postId ? c : null));
    if (!parentComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
  }

  const comment = await prisma.comment.create({
    data: { userId: session.user.id, postId, text: parsed.data.text, parentId },
    include: { user: { select: { id: true, name: true } } },
  });

  // A reply notifies the parent comment's author; a top-level comment
  // notifies the post owner — not both, to avoid double-notifying the post
  // owner when they're also who a reply's parent comment belongs to (they'll
  // already get the REPLY notification in that case).
  const notified: string[] = [];
  if (parentComment) {
    if (parentComment.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: parentComment.userId,
          actorId: session.user.id,
          type: "REPLY",
          postId,
          commentId: comment.id,
        },
      });
      notified.push(parentComment.userId);
    }
  } else if (post.userId !== session.user.id) {
    await prisma.notification.create({
      data: { userId: post.userId, actorId: session.user.id, type: "COMMENT", postId, commentId: comment.id },
    });
    notified.push(post.userId);
  }

  await notifyMentions({
    text: parsed.data.text,
    actorId: session.user.id,
    postId,
    commentId: comment.id,
    skipUserIds: notified,
  });

  // Shaped to match what the feed's initial server render sends down
  // (author, not the raw Prisma relation name user) — PostCard expects
  // comment.author on every comment, including ones it appends itself.
  return NextResponse.json({
    comment: {
      id: comment.id,
      text: comment.text,
      createdAt: comment.createdAt,
      author: comment.user,
      parentId: comment.parentId,
      likeCount: 0,
      likedByMe: false,
    },
  });
}
