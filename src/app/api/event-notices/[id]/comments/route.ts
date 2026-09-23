import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commentSchema } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: noticeId } = await params;

  const notice = await prisma.eventNotice.findUnique({ where: { id: noticeId } });
  if (!notice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const parentId = typeof body?.parentId === "string" ? body.parentId : null;
  if (parentId) {
    const parentComment = await prisma.eventNoticeComment.findUnique({
      where: { id: parentId },
      select: { noticeId: true },
    });
    if (!parentComment || parentComment.noticeId !== noticeId) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
  }

  const comment = await prisma.eventNoticeComment.create({
    data: { userId: session.user.id, noticeId, text: parsed.data.text, parentId },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    comment: {
      id: comment.id,
      text: comment.text,
      createdAt: comment.createdAt,
      author: comment.user,
      parentId: comment.parentId,
    },
  });
}
