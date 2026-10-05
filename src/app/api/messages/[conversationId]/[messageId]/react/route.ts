import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reactionSchema } from "@/lib/validation";

/** Toggles one of the fixed REACTION_EMOJIS on a message — same shape as /api/comments/[id]/react, participant-gated instead of public. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { conversationId, messageId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { emoji } = parsed.data;

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { conversation: { include: { participants: { select: { userId: true } } } } },
  });
  if (
    !message ||
    message.conversationId !== conversationId ||
    !message.conversation.participants.some((p) => p.userId === session.user.id)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.messageReaction.findUnique({
    where: { userId_messageId_emoji: { userId: session.user.id, messageId, emoji } },
  });

  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.messageReaction.create({ data: { userId: session.user.id, messageId, emoji } });
  }

  const reactions = await prisma.messageReaction.groupBy({
    by: ["emoji"],
    where: { messageId },
    _count: { emoji: true },
  });

  return NextResponse.json({
    emoji,
    reacted: !existing,
    reactions: reactions.map((r) => ({ emoji: r.emoji, count: r._count.emoji })),
  });
}
