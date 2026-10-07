import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rateLimit";
import { summarizeReactions } from "@/lib/reactions";
import { messageInclude, messageVisibilityWhere } from "@/lib/conversations";
import { PhotoUploadError, VideoUploadError, savePhotoUpload, saveVideoThumbnailUpload, saveVideoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";

async function loadAuthorizedConversation(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { select: { userId: true, hideHistory: true, joinedAt: true } } },
  });
  const me = conversation?.participants.find((p) => p.userId === userId);
  if (!conversation || !me) {
    return null;
  }
  return { ...conversation, me };
}

/** A quote-reply's target must be a real message in this same conversation — null for an invalid/missing id, same convention as comment replies. */
async function resolveReplyToId(conversationId: string, rawReplyToId: unknown): Promise<string | null> {
  if (typeof rawReplyToId !== "string" || !rawReplyToId) return null;
  const target = await prisma.message.findUnique({ where: { id: rawReplyToId }, select: { conversationId: true } });
  return target && target.conversationId === conversationId ? rawReplyToId : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { conversationId } = await params;
  const conversation = await loadAuthorizedConversation(conversationId, session.user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Viewing the thread marks the other participants' messages as read.
  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: session.user.id }, readAt: null },
    data: { readAt: new Date() },
  });

  const messages = await prisma.message.findMany({
    where: { conversationId, ...messageVisibilityWhere(conversation.me) },
    orderBy: { createdAt: "asc" },
    include: messageInclude,
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      ...m,
      reactions: summarizeReactions(m.reactions, session.user.id),
    })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { conversationId } = await params;
  const conversation = await loadAuthorizedConversation(conversationId, session.user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimit = checkRateLimit(session.user.id, "send-message", { limit: 30, windowMs: 60 * 1000 });
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "You're sending messages too fast. Please slow down." }, { status: 429 });
  }

  // A photo/video attachment comes in as multipart form data (it's a real
  // file upload); plain text/GIF messages stay JSON, same as before.
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const formData = await parseFormData(req);
    if (!formData) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const text = typeof formData.get("text") === "string" ? (formData.get("text") as string).trim() : "";
    const replyToId = await resolveReplyToId(conversationId, formData.get("replyToId"));
    const photoFile = formData.get("photo");
    const videoFile = formData.get("video");

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

    const message = await prisma.message.create({
      data: { conversationId, senderId: session.user.id, text, photo, video, videoThumbnail, replyToId },
      include: messageInclude,
    });

    return NextResponse.json({ message: { ...message, reactions: [] } });
  }

  const body = await req.json().catch(() => null);
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const replyToId = await resolveReplyToId(conversationId, body?.replyToId);

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: session.user.id,
      text: parsed.data.text,
      gifUrl: parsed.data.gifUrl ?? null,
      replyToId,
    },
    include: messageInclude,
  });

  return NextResponse.json({ message: { ...message, reactions: [] } });
}
