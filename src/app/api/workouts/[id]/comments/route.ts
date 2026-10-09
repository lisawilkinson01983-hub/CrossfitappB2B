import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { notifyMentions } from "@/lib/notify";

const workoutCommentSchema = z.object({ text: z.string().trim().min(1).max(1000) });

/** Whether the viewer may see (and so comment on) this workout — same gate as the gallery/PBs pages: owner, or an accepted follower of a private profile. */
async function canView(viewerId: string, ownerId: string, ownerIsPrivate: boolean) {
  if (viewerId === ownerId) return true;
  if (!ownerIsPrivate) return true;
  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: ownerId } },
  });
  return !!follow;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: workoutId } = await params;
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { userId: true, user: { select: { isPrivate: true } } },
  });
  if (!workout || !(await canView(session.user.id, workout.userId, workout.user.isPrivate))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const comments = await prisma.workoutComment.findMany({
    where: { workoutId },
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

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: workoutId } = await params;
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { userId: true, user: { select: { isPrivate: true } } },
  });
  if (!workout || !(await canView(session.user.id, workout.userId, workout.user.isPrivate))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = workoutCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const parentId = typeof body?.parentId === "string" ? body.parentId : null;
  let parentComment: { id: string; userId: string } | null = null;
  if (parentId) {
    parentComment = await prisma.workoutComment
      .findUnique({ where: { id: parentId }, select: { id: true, userId: true, workoutId: true } })
      .then((c) => (c && c.workoutId === workoutId ? c : null));
    if (!parentComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
  }

  const comment = await prisma.workoutComment.create({
    data: { userId: session.user.id, workoutId, text: parsed.data.text, parentId },
    include: { user: { select: { id: true, name: true } } },
  });

  // A reply notifies the parent comment's author; a top-level comment
  // notifies the workout owner — not both, same split as post comments.
  const recipientId = parentComment ? parentComment.userId : workout.userId;
  const notified: string[] = [];
  if (recipientId !== session.user.id) {
    await prisma.notification.create({
      data: { userId: recipientId, actorId: session.user.id, type: "WORKOUT_COMMENT", workoutId },
    });
    notified.push(recipientId);
  }

  await notifyMentions({
    text: parsed.data.text,
    actorId: session.user.id,
    workoutId,
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
