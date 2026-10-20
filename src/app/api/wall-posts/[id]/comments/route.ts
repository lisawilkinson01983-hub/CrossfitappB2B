import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyMentions } from "@/lib/notify";

const MAX_TEXT_LENGTH = 1000;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: wallPostId } = await params;

  const post = await prisma.wallPost.findUnique({ where: { id: wallPostId } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_TEXT_LENGTH) : "";
  if (!text) {
    return NextResponse.json({ error: "Comment can't be empty" }, { status: 400 });
  }

  const comment = await prisma.wallPostComment.create({
    data: { userId: session.user.id, wallPostId, text },
    include: { user: { select: { id: true, name: true } } },
  });

  const notified: string[] = [];
  if (post.authorId !== session.user.id) {
    await prisma.notification.create({
      data: { userId: post.authorId, actorId: session.user.id, type: "WALL_POST_COMMENT", wallPostId },
    });
    notified.push(post.authorId);
  }
  await notifyMentions({ text, actorId: session.user.id, wallPostId, skipUserIds: notified });

  return NextResponse.json({
    comment: {
      id: comment.id,
      text: comment.text,
      createdAt: comment.createdAt,
      author: comment.user,
      canDelete: true,
    },
  });
}
