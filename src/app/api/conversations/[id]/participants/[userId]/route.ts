import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Removes a participant from a group conversation — either leaving it
 * yourself or removing someone else. Flat permission, same as changing the
 * group photo: any current member can remove any other member, there's no
 * separate "admin" role. Never applies to a 1:1 conversation (leaving one of
 * those is just hiding it from your inbox — see DELETE /api/conversations/[id]).
 * If this empties the conversation, the whole thing (and its messages) is
 * deleted along with it.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: conversationId, userId: targetUserId } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { select: { userId: true } } },
  });
  if (!conversation || !conversation.isGroup) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isCallerMember = conversation.participants.some((p) => p.userId === session.user.id);
  const isTargetMember = conversation.participants.some((p) => p.userId === targetUserId);
  if (!isCallerMember || !isTargetMember) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.conversationParticipant.delete({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
  });

  if (conversation.participants.length === 1) {
    // That was the last member — nothing left to read this thread.
    await prisma.conversation.delete({ where: { id: conversationId } });
  }

  return NextResponse.json({ ok: true });
}
