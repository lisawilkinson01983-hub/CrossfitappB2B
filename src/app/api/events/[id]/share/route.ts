import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateConversation } from "@/lib/conversations";
import { formatEventDate } from "@/lib/eventDate";
import { checkRateLimit } from "@/lib/rateLimit";

/**
 * Shares a public event with one or more people as an opening message in
 * each of their own 1:1 conversations with the sharer — not a group, since
 * picking several people here means "send this to each of them", not
 * "put them all in a chat together". Private events already have their own
 * organizer-only invite flow (see /api/events/[id]/invite); this is for
 * spreading the word about an event anyone can already see.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (event.isPrivate || event.status !== "APPROVED") {
    return NextResponse.json({ error: "This event can't be shared" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const rawIds: unknown = body?.userIds;
  const candidateIds = Array.isArray(rawIds) ? rawIds : [];
  const targetIds = Array.from(
    new Set(candidateIds.filter((id): id is string => typeof id === "string" && id.length > 0))
  ).filter((id) => id !== session.user.id);
  if (targetIds.length === 0) {
    return NextResponse.json({ error: "Select at least one person to share with" }, { status: 400 });
  }
  if (targetIds.length > 20) {
    return NextResponse.json({ error: "You can share with at most 20 people at once" }, { status: 400 });
  }

  const targets = await prisma.user.findMany({ where: { id: { in: targetIds }, deletedAt: null } });
  if (targets.length !== targetIds.length) {
    return NextResponse.json({ error: "One of the people you selected couldn't be found" }, { status: 404 });
  }

  const rateLimit = checkRateLimit(session.user.id, "share-event", { limit: 20, windowMs: 60 * 1000 });
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "You're sharing too fast. Please slow down." }, { status: 429 });
  }

  const text = `Check out this event: @[${event.name}](event:${event.id})\n${formatEventDate(event)} · ${
    event.isOnline ? "Online" : event.location
  }`;

  for (const targetId of targetIds) {
    const conversation = await getOrCreateConversation(session.user.id, targetId);
    await prisma.message.create({ data: { conversationId: conversation.id, senderId: session.user.id, text } });
  }

  return NextResponse.json({ ok: true, shared: targetIds.length });
}
