import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageSchema } from "@/lib/validation";

async function loadAuthorizedConversation(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || (conversation.userOneId !== userId && conversation.userTwoId !== userId)) {
    return null;
  }
  return conversation;
}

export async function GET(_req: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { conversationId } = await params;
  const conversation = await loadAuthorizedConversation(conversationId, session.user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Viewing the thread marks the other participant's messages as read.
  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: session.user.id }, readAt: null },
    data: { readAt: new Date() },
  });

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { conversationId } = await params;
  const conversation = await loadAuthorizedConversation(conversationId, session.user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const message = await prisma.message.create({
    data: { conversationId, senderId: session.user.id, text: parsed.data.text },
    include: { sender: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ message });
}
