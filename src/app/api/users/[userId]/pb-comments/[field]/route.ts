import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PB_FIELDS, commentSchema } from "@/lib/validation";
import { notifyMentions } from "@/lib/notify";
import { summarizeReactions } from "@/lib/reactions";
import { PhotoUploadError, VideoUploadError, savePhotoUpload, saveVideoThumbnailUpload, saveVideoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";

const fieldParamSchema = z.enum(PB_FIELDS);

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

async function resolveParent(
  profileUserId: string,
  field: string,
  rawParentId: unknown
): Promise<{ id: string; userId: string } | null> {
  if (typeof rawParentId !== "string" || !rawParentId) return null;
  const parent = await prisma.pbComment.findUnique({
    where: { id: rawParentId },
    select: { id: true, userId: true, profileUserId: true, field: true },
  });
  return parent && parent.profileUserId === profileUserId && parent.field === field ? parent : null;
}

async function notifyCommentCreated({
  profileUserId,
  field,
  parentComment,
  actorId,
  text,
}: {
  profileUserId: string;
  field: string;
  parentComment: { id: string; userId: string } | null;
  actorId: string;
  text: string | null | undefined;
}) {
  // A reply notifies the parent comment's author; a top-level comment
  // notifies the profile owner — not both, same split as post comments.
  const recipientId = parentComment ? parentComment.userId : profileUserId;
  const notified: string[] = [];
  if (recipientId !== actorId) {
    await prisma.notification.create({
      data: { userId: recipientId, actorId, type: "PB_COMMENT", pbField: field },
    });
    notified.push(recipientId);
  }

  await notifyMentions({ text, actorId, pbField: field, skipUserIds: notified });
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

  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const formData = await parseFormData(req);
    if (!formData) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const text = typeof formData.get("text") === "string" ? (formData.get("text") as string).trim() : "";
    const parentComment = await resolveParent(profileUserId, parsedField.data, formData.get("parentId"));
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

    const comment = await prisma.pbComment.create({
      data: {
        userId: session.user.id,
        profileUserId,
        field: parsedField.data,
        text,
        photo,
        video,
        videoThumbnail,
        parentId: parentComment?.id ?? null,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    await notifyCommentCreated({
      profileUserId,
      field: parsedField.data,
      parentComment,
      actorId: session.user.id,
      text,
    });

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

  const parentComment = await resolveParent(profileUserId, parsedField.data, body?.parentId);
  if (body?.parentId && !parentComment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const comment = await prisma.pbComment.create({
    data: {
      userId: session.user.id,
      profileUserId,
      field: parsedField.data,
      text: parsed.data.text,
      gifUrl: parsed.data.gifUrl ?? null,
      parentId: parentComment?.id ?? null,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  await notifyCommentCreated({
    profileUserId,
    field: parsedField.data,
    parentComment,
    actorId: session.user.id,
    text: parsed.data.text,
  });

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
