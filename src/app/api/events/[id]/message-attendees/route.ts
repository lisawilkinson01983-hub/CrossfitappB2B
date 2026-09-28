import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createGroupConversation } from "@/lib/conversations";

/**
 * Gets (or starts) the group chat with a private event's current attendees —
 * organizer-only. Re-syncs membership on every call, so anyone who joined
 * since the chat was created gets added rather than left out.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!event.isPrivate) {
    return NextResponse.json({ error: "This event isn't private" }, { status: 400 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  const isOrganizer = event.createdById === session.user.id || event.submittedById === session.user.id;
  if (!isOrganizer && !me?.isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const participants = await prisma.eventParticipant.findMany({ where: { eventId }, select: { userId: true } });
  const attendeeIds = participants.map((p) => p.userId).filter((id) => id !== session.user.id);

  if (attendeeIds.length === 0) {
    return NextResponse.json({ error: "No one's joined this event yet" }, { status: 400 });
  }

  let conversationId = event.attendeesConversationId;

  if (conversationId) {
    const existingParticipants = await prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    const existingIds = new Set(existingParticipants.map((p) => p.userId));
    const newIds = attendeeIds.filter((id) => !existingIds.has(id));
    if (newIds.length > 0) {
      await prisma.conversationParticipant.createMany({
        data: newIds.map((userId) => ({ conversationId: conversationId!, userId })),
      });
    }
  } else {
    const conversation = await createGroupConversation(session.user.id, attendeeIds, event.name);
    conversationId = conversation.id;
    await prisma.event.update({ where: { id: eventId }, data: { attendeesConversationId: conversationId } });
  }

  return NextResponse.json({ id: conversationId });
}
