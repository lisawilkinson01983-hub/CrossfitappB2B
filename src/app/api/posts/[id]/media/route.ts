import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Removes one photo/video from the caller's own post — used by the profile
 * Gallery's delete action. Two shapes of post can hold media (see
 * src/lib/posts.ts): the `media` array (PostMedia rows, the current way),
 * or, on an old post from before that existed, the legacy `photo`/`video`
 * columns directly on Post — pass `mediaId` for the former, omit it for the
 * latter. Either way, if removing it leaves the post with nothing left (no
 * caption, no other media, not a share/workout/event post), the whole post
 * is deleted instead of leaving an empty card behind — same "empty post"
 * rule as editing a caption down to nothing (see PATCH /api/posts/[id]).
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: postId } = await params;
  const { searchParams } = new URL(req.url);
  const mediaId = searchParams.get("mediaId");

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { media: { select: { id: true } } },
  });
  if (!post || post.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (mediaId) {
    const media = post.media.find((m) => m.id === mediaId);
    if (!media) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.postMedia.delete({ where: { id: mediaId } });
  } else if (!post.photo && !post.video) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const remainingMedia = mediaId ? post.media.length - 1 : post.media.length;
  const stillHasLegacyMedia = mediaId ? Boolean(post.photo || post.video) : false;
  const isNowEmpty =
    !post.sharedFromId &&
    !post.contentText &&
    !post.linkedWorkoutId &&
    !post.linkedEventId &&
    remainingMedia === 0 &&
    !stillHasLegacyMedia;

  if (isNowEmpty) {
    await prisma.post.delete({ where: { id: postId } });
    return NextResponse.json({ ok: true, postDeleted: true });
  }

  if (!mediaId) {
    await prisma.post.update({ where: { id: postId }, data: { photo: null, video: null, videoThumbnail: null } });
  }

  return NextResponse.json({ ok: true, postDeleted: false });
}
