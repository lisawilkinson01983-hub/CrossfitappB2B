import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { copyServedMedia } from "@/lib/uploads";
import { MAX_STORY_MENTIONS, storyExpiresAt } from "@/lib/stories";

/**
 * Posts an existing feed post's own video straight to Story, server-side —
 * the file is copied on disk rather than the browser fetching it into a
 * Blob and re-uploading it (see ShareSheet's doShare/resolveFinalVideo for
 * the fallback still used once on-video text has been added, since that
 * edited file only ever exists client-side). See copyServedMedia for why
 * that client round trip turned out to be where real share-to-story video
 * failures were coming from.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(session.user.id, "create-story", { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "You're posting too many stories. Please slow down." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const postId = typeof body?.postId === "string" ? body.postId : null;
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  // Same visibility rule as /api/share/post/[postId]/image — a feed post
  // isn't otherwise access-controlled beyond block/mute, which sharing it
  // doesn't need to re-check.
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      video: true,
      videoThumbnail: true,
      media: { where: { kind: "VIDEO" }, orderBy: { order: "asc" }, take: 1, select: { url: true, thumbnail: true } },
    },
  });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const sourceVideoUrl = post.video ?? post.media[0]?.url ?? null;
  const sourceThumbnailUrl = post.video ? post.videoThumbnail : (post.media[0]?.thumbnail ?? null);
  if (!sourceVideoUrl) {
    return NextResponse.json({ error: "That post has no video" }, { status: 400 });
  }

  const video = await copyServedMedia(sourceVideoUrl, session.user.id);
  if (!video) {
    return NextResponse.json({ error: "Couldn't read that video" }, { status: 500 });
  }
  const videoThumbnail = sourceThumbnailUrl ? await copyServedMedia(sourceThumbnailUrl, session.user.id) : null;

  const rawMentionIds: string[] = Array.isArray(body?.mentionedUserIds)
    ? body.mentionedUserIds.filter((v: unknown): v is string => typeof v === "string")
    : [];
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
