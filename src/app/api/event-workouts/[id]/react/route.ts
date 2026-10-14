import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reactionSchema } from "@/lib/validation";
import { assertEventVisible } from "@/lib/eventVisibility";

/** Toggles one of the fixed REACTION_EMOJIS on a numbered workout — open to anyone who can see the event (see assertEventVisible), not just its editors. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: eventWorkoutId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { emoji } = parsed.data;

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

  const existing = await prisma.eventWorkoutReaction.findUnique({
    where: { userId_eventWorkoutId_emoji: { userId: session.user.id, eventWorkoutId, emoji } },
  });

  if (existing) {
    await prisma.eventWorkoutReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.eventWorkoutReaction.create({ data: { userId: session.user.id, eventWorkoutId, emoji } });
    if (workout.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: workout.userId,
          actorId: session.user.id,
          type: "EVENT_WORKOUT_REACTION",
          eventId: workout.eventId,
          eventWorkoutId,
          emoji,
        },
      });
    }
  }

  const reactions = await prisma.eventWorkoutReaction.groupBy({
    by: ["emoji"],
    where: { eventWorkoutId },
    _count: { emoji: true },
  });

  return NextResponse.json({
    emoji,
    reacted: !existing,
    reactions: reactions.map((r) => ({ emoji: r.emoji, count: r._count.emoji })),
  });
}
