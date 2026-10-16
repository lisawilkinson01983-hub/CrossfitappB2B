import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commentSchema } from "@/lib/validation";
import { notifyMentions } from "@/lib/notify";
import { PhotoUploadError, VideoUploadError, savePhotoUpload, saveVideoThumbnailUpload, saveVideoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";
import { summarizeReactions } from "@/lib/reactions";

/**
 * Flat comment list for a post — used by the gallery popout (see
 * CommentsPopout.tsx), which shows every comment on the underlying post
 * chronologically rather than the full reply/reaction thread PostCard
 * renders inline in the feed.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: postId } = await params;
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const comments = await prisma.comment.findMany({
    where: { postId },
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

async function resolveParent(postId: string, rawParentId: unknown): Promise<{ id: string; userId: string } | null> {
  if (typeof rawParentId !== "string" || !rawParentId) return null;
  const parent = await prisma.comment.findUnique({
    where: { id: rawParentId },
    select: { id: true, userId: true, postId: true },
  });
  return parent && parent.postId === postId ? parent : null;
}

/**
 * A reply notifies the parent comment's author; a top-level comment notifies
 * the post owner — not both, to avoid double-notifying the post owner when
 * they're also who a reply's parent comment belongs to (they'll already get
 * the REPLY notification in that case). Also fires any @mentions in the
 * comment's text, skipping whoever was already notified above.
 */
async function notifyCommentCreated({
  post,
  parentComment,
  actorId,
  commentId,
  text,
}: {
  post: { id: string; userId: string };
  parentComment: { id: string; userId: string } | null;
  actorId: string;
  commentId: string;
  text: string | null | undefined;
}) {
  const notified: string[] = [];
  if (parentComment) {
    if (parentComment.userId !== actorId) {
      await prisma.notification.create({
        data: { userId: parentComment.userId, actorId, type: "REPLY", postId: post.id, commentId },
      });
      notified.push(parentComment.userId);
    }
  } else if (post.userId !== actorId) {
    await prisma.notification.create({
      data: { userId: post.userId, actorId, type: "COMMENT", postId: post.id, commentId },
    });
    notified.push(post.userId);
  }

  await notifyMentions({ text, actorId, postId: post.id, commentId, skipUserIds: notified });
}

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

  // A photo/video attachment comes in as multipart form data (it's a real
  // file upload); plain text/GIF comments stay JSON, same as
  // /api/event-notices/[id]/comments.
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const formData = await parseFormData(req);
    if (!formData) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const text = typeof formData.get("text") === "string" ? (formData.get("text") as string).trim() : "";
    const parentComment = await resolveParent(postId, formData.get("parentId"));
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

    const comment = await prisma.comment.create({
      data: {
        userId: session.user.id,
        postId,
        text,
        photo,
        video,
        videoThumbnail,
        parentId: parentComment?.id ?? null,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    await notifyCommentCreated({ post, parentComment, actorId: session.user.id, commentId: comment.id, text });

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
        likeCount: 0,
        likedByMe: false,
        reactions: [],
      },
    });
  }

  const body = await req.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const parentComment = await resolveParent(postId, body?.parentId);
  if (body?.parentId && !parentComment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const comment = await prisma.comment.create({
    data: {
      userId: session.user.id,
      postId,
      text: parsed.data.text,
      gifUrl: parsed.data.gifUrl ?? null,
      parentId: parentComment?.id ?? null,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  await notifyCommentCreated({
    post,
    parentComment,
    actorId: session.user.id,
    commentId: comment.id,
    text: parsed.data.text,
  });

  // Shaped to match what the feed's initial server render sends down
  // (author, not the raw Prisma relation name user) — PostCard expects
  // comment.author on every comment, including ones it appends itself.
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
      likeCount: 0,
      likedByMe: false,
      reactions: [],
    },
  });
}
