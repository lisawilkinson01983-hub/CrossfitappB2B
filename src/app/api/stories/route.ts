import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { parseFormData } from "@/lib/http";
import {
  PhotoUploadError,
  VideoUploadError,
  savePhotoUpload,
  saveVideoThumbnailUpload,
  saveVideoUpload,
} from "@/lib/uploads";
import { activeStoryWhere, groupStoriesByAuthor, storyCardInclude, storyExpiresAt } from "@/lib/stories";

const MAX_STORY_MENTIONS = 10;

/** All currently-active stories the viewer is allowed to see (everyone except blocked/muted), grouped by author — see StoriesBar. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [blocked, muted] = await Promise.all([
    prisma.block.findMany({ where: { blockerId: session.user.id }, select: { blockedId: true } }),
    prisma.mute.findMany({ where: { userId: session.user.id }, select: { mutedUserId: true } }),
  ]);
  const hiddenUserIds = [...blocked.map((b) => b.blockedId), ...muted.map((m) => m.mutedUserId)];

  const stories = await prisma.story.findMany({
    where: { ...activeStoryWhere(), userId: { notIn: hiddenUserIds } },
    orderBy: { createdAt: "asc" },
    include: storyCardInclude,
  });

  return NextResponse.json({ groups: groupStoriesByAuthor(stories, session.user.id) });
}

/** Posts a new story — a photo, or a video with its client-captured poster frame (same multipart shape as a message/post media upload). */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(session.user.id, "create-story", { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "You're posting too many stories. Please slow down." }, { status: 429 });
  }

  const formData = await parseFormData(req);
  if (!formData) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

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

  const rawMentionIds = formData.getAll("mentionedUserIds").filter((v): v is string => typeof v === "string");
  const candidateMentionIds = Array.from(new Set(rawMentionIds)).filter((id) => id !== session.user.id);
  const taggedUsers =
    candidateMentionIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: candidateMentionIds.slice(0, MAX_STORY_MENTIONS) } },
          select: { id: true },
        })
      : [];

  const now = new Date();
  const story = await prisma.story.create({
    data: {
      userId: session.user.id,
      photo,
      video,
      videoThumbnail,
      createdAt: now,
      expiresAt: storyExpiresAt(now),
      mentions: { create: taggedUsers.map((u) => ({ userId: u.id })) },
    },
  });

  if (taggedUsers.length > 0) {
    await prisma.notification.createMany({
      data: taggedUsers.map((u) => ({
        userId: u.id,
        actorId: session.user.id,
        type: "MENTION" as const,
        storyId: story.id,
      })),
    });
  }

  return NextResponse.json({ story });
}
