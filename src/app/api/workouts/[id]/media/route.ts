import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Removes a workout's photo/video — used by the profile Gallery's delete
 * action. Unlike a post, the workout log entry itself is never deleted just
 * for losing its photo; only the attachment fields are cleared, on the
 * workout and (if it's shared to the feed) its linked Post, to keep the two
 * in sync the same way editing the workout's photo already does.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const workout = await prisma.workout.findUnique({ where: { id } });
  if (!workout || workout.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!workout.photo && !workout.video) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const clearedMedia = { photo: null, video: null, videoThumbnail: null };

  await prisma.workout.update({ where: { id }, data: clearedMedia });

  const linkedPost = await prisma.post.findFirst({ where: { linkedWorkoutId: id } });
  if (linkedPost) {
    await prisma.post.update({ where: { id: linkedPost.id }, data: clearedMedia });
  }

  return NextResponse.json({ ok: true });
}
