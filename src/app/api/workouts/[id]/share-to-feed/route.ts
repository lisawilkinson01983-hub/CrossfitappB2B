import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * A lightweight "share this to my feed" for a workout that's already been
 * logged — unlike PATCH /api/workouts/[id], which needs the full edit form
 * payload, this just flips sharedToFeed and creates the linked Post (or is
 * a no-op if it's already shared), mirroring that route's own
 * sharedToFeed=true branch.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const workout = await prisma.workout.findUnique({ where: { id } });
  if (!workout || workout.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (workout.sharedToFeed) {
    const linkedPost = await prisma.post.findFirst({ where: { linkedWorkoutId: id }, select: { id: true } });
    return NextResponse.json({ ok: true, postId: linkedPost?.id ?? null });
  }

  const linkedPost = await prisma.post.findFirst({ where: { linkedWorkoutId: id } });
  const postData = {
    type: workout.isPb ? ("PR" as const) : ("WORKOUT" as const),
    contentText: workout.notes ?? null,
    photo: workout.photo,
    video: workout.video,
    videoThumbnail: workout.videoThumbnail,
  };

  const postId = linkedPost
    ? (await prisma.post.update({ where: { id: linkedPost.id }, data: postData })).id
    : (await prisma.post.create({ data: { userId: session.user.id, linkedWorkoutId: id, ...postData } })).id;

  await prisma.workout.update({ where: { id }, data: { sharedToFeed: true } });

  return NextResponse.json({ ok: true, postId });
}
