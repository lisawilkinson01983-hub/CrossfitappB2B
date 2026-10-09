import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commentSchema } from "@/lib/validation";
import { notifyMentions } from "@/lib/notify";
import { PhotoUploadError, VideoUploadError, savePhotoUpload, saveVideoThumbnailUpload, saveVideoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";

async function resolveParent(noticeId: string, rawParentId: unknown): Promise<{ id: string; userId: string } | null> {
  if (typeof rawParentId !== "string" || !rawParentId) return null;
  const parent = await prisma.eventNoticeComment.findUnique({
    where: { id: rawParentId },
    select: { id: true, userId: true, noticeId: true },
  });
  return parent && parent.noticeId === noticeId ? parent : null;
}

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

  // A photo/video attachment comes in as multipart form data (it's a real
  // file upload); plain text/GIF comments stay JSON, same as /api/messages.
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const formData = await parseFormData(req);
    if (!formData) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const text = typeof formData.get("text") === "string" ? (formData.get("text") as string).trim() : "";
    const parentComment = await resolveParent(noticeId, formData.get("parentId"));
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

    const comment = await prisma.eventNoticeComment.create({
      data: { userId: session.user.id, noticeId, text, photo, video, videoThumbnail, parentId: parentComment?.id ?? null },
      include: { user: { select: { id: true, name: true } } },
    });

    await notifyCommentCreated({ notice, parentComment, actorId: session.user.id, text });

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
        reactions: [],
      },
    });
  }

  const body = await req.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const parentComment = await resolveParent(noticeId, body?.parentId);
  if (body?.parentId && !parentComment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const comment = await prisma.eventNoticeComment.create({
    data: {
      userId: session.user.id,
      noticeId,
      text: parsed.data.text,
      gifUrl: parsed.data.gifUrl ?? null,
      parentId: parentComment?.id ?? null,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  await notifyCommentCreated({ notice, parentComment, actorId: session.user.id, text: parsed.data.text });

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
      reactions: [],
    },
  });
}

/**
 * A reply notifies the parent comment's author; a top-level comment notifies
 * the notice author — not both, same split as post comments. Also fires any
 * @mentions in the comment's text, skipping whoever was already notified
 * above so they don't get a duplicate notification for one action.
 */
async function notifyCommentCreated({
  notice,
  parentComment,
  actorId,
  text,
}: {
  notice: { userId: string; eventId: string };
  parentComment: { id: string; userId: string } | null;
  actorId: string;
  text: string | null | undefined;
}) {
  const recipientId = parentComment ? parentComment.userId : notice.userId;
  const notified: string[] = [];
  if (recipientId !== actorId) {
    await prisma.notification.create({
      data: { userId: recipientId, actorId, type: "EVENT_NOTICE_COMMENT", eventId: notice.eventId },
    });
    notified.push(recipientId);
  }

  await notifyMentions({ text, actorId, eventId: notice.eventId, skipUserIds: notified });
}
