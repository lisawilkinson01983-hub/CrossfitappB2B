import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { storyExpiresAt } from "@/lib/stories";

/**
 * Reposts someone else's still-active story as a brand new one under the
 * caller's own account — the "share to your story" action offered from a
 * "you were tagged" notification (see NotificationStoryPreview). Limited to
 * the story's own author or someone it actually tagged, same as Instagram
 * only offering this from a story you were mentioned in, not any story you
 * can merely see. Carries over the media/text/background only — never the
 * original's tags, since re-tagging the same people on every reshare would
 * fan a single mention out into a repeating chain of notifications.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(session.user.id, "create-story", { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "You're posting too many stories. Please slow down." }, { status: 429 });
  }

  const { id } = await params;
  const story = await prisma.story.findUnique({
    where: { id },
    select: {
      userId: true,
      photo: true,
      video: true,
      videoThumbnail: true,
      text: true,
      backgroundColor: true,
      expiresAt: true,
      mentions: { select: { userId: true } },
    },
  });
  if (!story) {
    return NextResponse.json({ error: "That story isn't available anymore" }, { status: 404 });
  }
  if (story.expiresAt <= new Date()) {
    return NextResponse.json({ error: "That story has expired" }, { status: 410 });
  }
  const allowed = story.userId === session.user.id || story.mentions.some((m) => m.userId === session.user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const now = new Date();
  const reshared = await prisma.story.create({
    data: {
      userId: session.user.id,
      photo: story.photo,
      video: story.video,
      videoThumbnail: story.videoThumbnail,
      text: story.text,
      backgroundColor: story.backgroundColor,
      createdAt: now,
      expiresAt: storyExpiresAt(now),
    },
  });

  return NextResponse.json({ story: reshared });
}
