import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateConversation } from "@/lib/conversations";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const targetId = body?.userId;
  if (typeof targetId !== "string" || !targetId) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (targetId === session.user.id) {
    return NextResponse.json({ error: "You can't message yourself" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const conversation = await getOrCreateConversation(session.user.id, targetId);

  return NextResponse.json({ id: conversation.id });
}
