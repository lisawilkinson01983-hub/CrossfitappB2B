import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reactionSchema } from "@/lib/validation";

/** Toggles one of the fixed REACTION_EMOJIS on another user's current status — same shape as the comment/message reaction toggle. */
export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userId } = await params;
  if (userId === session.user.id) {
    return NextResponse.json({ error: "You can't react to your own status" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { emoji } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!target?.status) {
    return NextResponse.json({ error: "This person doesn't have a status set right now" }, { status: 404 });
  }

  const existing = await prisma.statusReaction.findUnique({
    where: { userId_reactorId_emoji: { userId, reactorId: session.user.id, emoji } },
  });

  if (existing) {
    await prisma.statusReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.statusReaction.create({ data: { userId, reactorId: session.user.id, emoji } });
    await prisma.notification.create({
      data: { userId, actorId: session.user.id, type: "STATUS_REACTION", emoji },
    });
  }

  const reactions = await prisma.statusReaction.groupBy({
    by: ["emoji"],
    where: { userId },
    _count: { emoji: true },
  });

  return NextResponse.json({
    emoji,
    reacted: !existing,
    reactions: reactions.map((r) => ({ emoji: r.emoji, count: r._count.emoji })),
  });
}
