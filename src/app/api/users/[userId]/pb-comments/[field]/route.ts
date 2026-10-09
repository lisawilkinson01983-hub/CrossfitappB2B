import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PB_FIELDS } from "@/lib/validation";
import { notifyMentions } from "@/lib/notify";

const fieldParamSchema = z.enum(PB_FIELDS);
const pbCommentSchema = z.object({ text: z.string().trim().min(1).max(1000) });

/** Whether the viewer may see (and so comment on) this profile's PBs — same gate as /profile/[userId]/pbs. */
async function canView(viewerId: string, profileUserId: string, profileIsPrivate: boolean) {
  if (viewerId === profileUserId) return true;
  if (!profileIsPrivate) return true;
  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: profileUserId } },
  });
  return !!follow;
}

export async function GET(_req: Request, { params }: { params: Promise<{ userId: string; field: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userId: profileUserId, field: rawField } = await params;
  const parsedField = fieldParamSchema.safeParse(rawField);
  if (!parsedField.success) {
    return NextResponse.json({ error: "Unknown PB" }, { status: 400 });
  }

  const profileUser = await prisma.user.findUnique({ where: { id: profileUserId }, select: { isPrivate: true } });
  if (!profileUser || !(await canView(session.user.id, profileUserId, profileUser.isPrivate))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const comments = await prisma.pbComment.findMany({
    where: { profileUserId, field: parsedField.data },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      text: c.text,
      createdAt: c.createdAt,
      author: c.user,
      parentId: c.parentId,
      isMine: c.userId === session.user.id,
    })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ userId: string; field: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userId: profileUserId, field: rawField } = await params;
  const parsedField = fieldParamSchema.safeParse(rawField);
  if (!parsedField.success) {
    return NextResponse.json({ error: "Unknown PB" }, { status: 400 });
  }

  const profileUser = await prisma.user.findUnique({ where: { id: profileUserId }, select: { isPrivate: true } });
  if (!profileUser || !(await canView(session.user.id, profileUserId, profileUser.isPrivate))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = pbCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const parentId = typeof body?.parentId === "string" ? body.parentId : null;
  let parentComment: { id: string; userId: string } | null = null;
  if (parentId) {
    parentComment = await prisma.pbComment
      .findUnique({ where: { id: parentId }, select: { id: true, userId: true, profileUserId: true, field: true } })
      .then((c) => (c && c.profileUserId === profileUserId && c.field === parsedField.data ? c : null));
    if (!parentComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
  }

  const comment = await prisma.pbComment.create({
    data: { userId: session.user.id, profileUserId, field: parsedField.data, text: parsed.data.text, parentId },
    include: { user: { select: { id: true, name: true } } },
  });

  // A reply notifies the parent comment's author; a top-level comment
  // notifies the profile owner — not both, same split as post comments.
  const recipientId = parentComment ? parentComment.userId : profileUserId;
  const notified: string[] = [];
  if (recipientId !== session.user.id) {
    await prisma.notification.create({
      data: { userId: recipientId, actorId: session.user.id, type: "PB_COMMENT", pbField: parsedField.data },
    });
    notified.push(recipientId);
  }

  await notifyMentions({
    text: parsed.data.text,
    actorId: session.user.id,
    pbField: parsedField.data,
    skipUserIds: notified,
  });

  return NextResponse.json({
    comment: {
      id: comment.id,
      text: comment.text,
      createdAt: comment.createdAt,
      author: comment.user,
      parentId: comment.parentId,
      isMine: true,
    },
  });
}
