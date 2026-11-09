import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Copies a wall post into the current user's own main feed as a new post —
 * a one-time "share", not a live reshare like /api/posts/[id]/share (a wall
 * post has no feed presence of its own to point back at, and a wall post
 * isn't owned by a single author the way a Post's reshare chain assumes).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: wallPostId } = await params;

  const wallPost = await prisma.wallPost.findUnique({ where: { id: wallPostId } });
  if (!wallPost) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.post.create({
    data: {
      userId: session.user.id,
      type: "UPDATE",
      contentText: wallPost.text,
      photo: wallPost.photo,
      video: wallPost.video,
      videoThumbnail: wallPost.videoThumbnail,
      gifUrl: wallPost.gifUrl,
      sharedToFeed: true,
    },
  });

  if (wallPost.authorId !== session.user.id) {
    await prisma.notification.create({
      data: { userId: wallPost.authorId, actorId: session.user.id, type: "WALL_POST_SHARE", wallPostId },
    });
  }

  return NextResponse.json({ ok: true });
}
