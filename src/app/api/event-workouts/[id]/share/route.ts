import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertEventVisible } from "@/lib/eventVisibility";

/**
 * Toggles the current user's share of a numbered workout into their own
 * feed (see Post.linkedEventWorkoutId) — same toggle shape as
 * /api/posts/[id]/share, just for an EventWorkout instead of another post.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: eventWorkoutId } = await params;
  const workout = await prisma.eventWorkout.findUnique({
    where: { id: eventWorkoutId },
    include: { event: true },
  });
  if (!workout) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await assertEventVisible(workout.event, session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.post.findUnique({
    where: { userId_linkedEventWorkoutId: { userId: session.user.id, linkedEventWorkoutId: eventWorkoutId } },
  });

  if (existing) {
    await prisma.post.delete({ where: { id: existing.id } });
  } else {
    await prisma.post.create({
      data: { userId: session.user.id, type: "UPDATE", linkedEventWorkoutId: eventWorkoutId },
    });
  }

  const count = await prisma.post.count({ where: { linkedEventWorkoutId: eventWorkoutId } });

  return NextResponse.json({ shared: !existing, count });
}
