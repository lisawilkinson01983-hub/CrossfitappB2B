import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addParticipantsSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(50),
  // Whether the people being added can see messages sent before they joined
  // — asked explicitly in the UI rather than assumed, since either default
  // surprises someone (showing a new member the whole history, or leaving
  // them unable to follow a conversation already in progress).
  shareHistory: z.boolean(),
});

/**
 * Adds one or more people to an existing group — same flat permission as
 * removing a member or changing the group photo: any current member can add
 * anyone. See DELETE on /api/conversations/[id]/participants/[userId] for
 * removal, and /messages/[conversationId]/members for the UI this backs.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { select: { userId: true } } },
  });
  if (!conversation || !conversation.isGroup) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!conversation.participants.some((p) => p.userId === session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = addParticipantsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existingIds = new Set(conversation.participants.map((p) => p.userId));
  const newUserIds = Array.from(new Set(parsed.data.userIds)).filter((id) => !existingIds.has(id));
  if (newUserIds.length === 0) {
    return NextResponse.json({ error: "Everyone chosen is already in this group" }, { status: 400 });
  }

  const validUsers = await prisma.user.findMany({ where: { id: { in: newUserIds } }, select: { id: true } });
  if (validUsers.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.conversationParticipant.createMany({
    data: validUsers.map((u) => ({
      conversationId,
      userId: u.id,
      hideHistory: !parsed.data.shareHistory,
    })),
  });

  return NextResponse.json({ ok: true, added: validUsers.length });
}
