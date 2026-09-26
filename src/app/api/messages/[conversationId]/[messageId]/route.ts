import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageSchema } from "@/lib/validation";

async function loadOwnMessage(conversationId: string, messageId: string, userId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.conversationId !== conversationId || message.senderId !== userId) {
    return null;
  }
  return message;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { conversationId, messageId } = await params;
  const message = await loadOwnMessage(conversationId, messageId, session.user.id);
  if (!message || message.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { text: parsed.data.text, editedAt: new Date() },
    include: { sender: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ message: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { conversationId, messageId } = await params;
  const message = await loadOwnMessage(conversationId, messageId, session.user.id);
  if (!message || message.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft-deleted, same as Comment/EventNoticeComment — the placeholder text
  // keeps the thread's order and read state intact for everyone else in it.
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { text: "[deleted]", deletedAt: new Date() },
    include: { sender: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ message: updated });
}
