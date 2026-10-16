import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commentSchema } from "@/lib/validation";
import { notifyMentions } from "@/lib/notify";
import { summarizeReactions } from "@/lib/reactions";
import { PhotoUploadError, VideoUploadError, savePhotoUpload, saveVideoThumbnailUpload, saveVideoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";

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
    include: {
      user: { select: { id: true, name: true } },
      reactions: { select: { emoji: true, userId: true } },
    },
  });

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      text: c.text,
      gifUrl: c.gifUrl,
      photo: c.photo,
      video: c.video,
      videoThumbnail: c.videoThumbnail,
      createdAt: c.createdAt,
      author: c.user,
      parentId: c.parentId,
      isMine: c.userId === session.user.id,
      reactions: summarizeReactions(c.reactions, session.user.id),
    })),
  });
}

async function resolveParent(workoutId: string, rawParentId: unknown): Promise<{ id: string; userId: string } | null> {
  if (typeof rawParentId !== "string" || !rawParentId) return null;
  const parent = await prisma.workoutComment.findUnique({
    where: { id: rawParentId },
    select: { id: true, userId: true, workoutId: true },
  });
  return parent && parent.workoutId === workoutId ? parent : null;
}

async function notifyCommentCreated({
  workout,
  parentComment,
  actorId,
  text,
  workoutId,
}: {
  workout: { userId: string };
  parentComment: { id: string; userId: string } | null;
  actorId: string;
  text: string | null | undefined;
  workoutId: string;
}) {
  // A reply notifies the parent comment's author; a top-level comment
  // notifies the workout owner — not both, same split as post comments.
  const recipientId = parentComment ? parentComment.userId : workout.userId;
  const notified: string[] = [];
  if (recipientId !== actorId) {
    await prisma.notification.create({
      data: { userId: recipientId, actorId, type: "WORKOUT_COMMENT", workoutId },
    });
    notified.push(recipientId);
  }

  await notifyMentions({ text, actorId, workoutId, skipUserIds: notified });
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

  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const formData = await parseFormData(req);
    if (!formData) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const text = typeof formData.get("text") === "string" ? (formData.get("text") as string).trim() : "";
    const parentComment = await resolveParent(workoutId, formData.get("parentId"));
    if (formData.get("parentId") && !parentComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const videoFile = formData.get("video");
    const photoFile = formData.get("photo");
    let photo: string | null = null;
    let video: string | null = null;
    let videoThumbnail: string | null = null;

    if (videoFile instanceof File && videoFile.size > 0) {
      try {
        video = await saveVideoUpload(videoFile, session.user.id);
      } catch (err) {
        if (err instanceof VideoUploadError) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
        throw err;
      }
      const thumbnailFile = formData.get("thumbnail");
      if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
        videoThumbnail = await saveVideoThumbnailUpload(thumbnailFile, session.user.id);
      }
    } else if (photoFile instanceof File && photoFile.size > 0) {
      try {
        photo = await savePhotoUpload(photoFile, session.user.id);
      } catch (err) {
        if (err instanceof PhotoUploadError) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
        throw err;
      }
    } else {
      return NextResponse.json({ error: "Add a photo or video" }, { status: 400 });
    }

    const comment = await prisma.workoutComment.create({
      data: {
        userId: session.user.id,
        workoutId,
        text,
        photo,
        video,
        videoThumbnail,
        parentId: parentComment?.id ?? null,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    await notifyCommentCreated({ workout, parentComment, actorId: session.user.id, text, workoutId });

    return NextResponse.json({
      comment: {
        id: comment.id,
        text: comment.text,
        gifUrl: comment.gifUrl,
        photo: comment.photo,
        video: comment.video,
        videoThumbnail: comment.videoThumbnail,
        createdAt: comment.createdAt,
        author: comment.user,
        parentId: comment.parentId,
        isMine: true,
        reactions: [],
      },
    });
  }

  const body = await req.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const parentComment = await resolveParent(workoutId, body?.parentId);
  if (body?.parentId && !parentComment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const comment = await prisma.workoutComment.create({
    data: {
      userId: session.user.id,
      workoutId,
      text: parsed.data.text ?? "",
      gifUrl: parsed.data.gifUrl ?? null,
      parentId: parentComment?.id ?? null,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  await notifyCommentCreated({ workout, parentComment, actorId: session.user.id, text: parsed.data.text, workoutId });

  return NextResponse.json({
    comment: {
      id: comment.id,
      text: comment.text,
      gifUrl: comment.gifUrl,
      photo: comment.photo,
      video: comment.video,
      videoThumbnail: comment.videoThumbnail,
      createdAt: comment.createdAt,
      author: comment.user,
      parentId: comment.parentId,
      isMine: true,
      reactions: [],
    },
  });
}
