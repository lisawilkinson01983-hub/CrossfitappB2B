import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseFormData } from "@/lib/http";
import { PhotoUploadError, savePhotoUpload } from "@/lib/uploads";
import { notifyMentions } from "@/lib/notify";
import { wallPostInclude, toWallPostCardData } from "@/lib/wallPosts";

const MAX_TEXT_LENGTH = 2000;

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userId: wallOwnerId } = await params;

  const wallOwner = await prisma.user.findUnique({ where: { id: wallOwnerId } });
  if (!wallOwner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Same gating as the rest of a locked profile — a private account only
  // opens up to an accepted follower (or the owner themselves).
  if (wallOwner.isPrivate && wallOwnerId !== session.user.id) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: session.user.id, followingId: wallOwnerId } },
    });
    if (!follow) {
      return NextResponse.json({ error: "This account is private" }, { status: 403 });
    }
  }

  const formData = await parseFormData(req);
  if (!formData) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawText = formData.get("text");
  const text = typeof rawText === "string" ? rawText.trim().slice(0, MAX_TEXT_LENGTH) : "";

  const photoFile = formData.get("photo");
  let photoPath: string | null = null;
  if (photoFile instanceof File && photoFile.size > 0) {
    try {
      photoPath = await savePhotoUpload(photoFile, session.user.id);
    } catch (err) {
      if (err instanceof PhotoUploadError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  if (!text && !photoPath) {
    return NextResponse.json({ error: "Write something, or add a photo" }, { status: 400 });
  }

  const post = await prisma.wallPost.create({
    data: {
      wallOwnerId,
      authorId: session.user.id,
      text: text || null,
      photo: photoPath,
    },
    include: wallPostInclude,
  });

  const notified: string[] = [];
  if (wallOwnerId !== session.user.id) {
    await prisma.notification.create({
      data: { userId: wallOwnerId, actorId: session.user.id, type: "WALL_POST", wallPostId: post.id },
    });
    notified.push(wallOwnerId);
  }
  await notifyMentions({ text, actorId: session.user.id, wallPostId: post.id, skipUserIds: notified });

  return NextResponse.json({ post: toWallPostCardData(post, session.user.id, wallOwnerId) });
}
