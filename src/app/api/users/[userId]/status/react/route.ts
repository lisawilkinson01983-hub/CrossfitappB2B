import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Toggles the current user's reaction to another user's current status. */
export async function POST(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userId } = await params;
  if (userId === session.user.id) {
    return NextResponse.json({ error: "You can't react to your own status" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!target?.status) {
    return NextResponse.json({ error: "This person doesn't have a status set right now" }, { status: 404 });
  }

  const existing = await prisma.statusReaction.findUnique({
    where: { userId_reactorId: { userId, reactorId: session.user.id } },
  });

  if (existing) {
    await prisma.statusReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.statusReaction.create({ data: { userId, reactorId: session.user.id } });
    await prisma.notification.create({
      data: { userId, actorId: session.user.id, type: "STATUS_REACTION" },
    });
  }

  const count = await prisma.statusReaction.count({ where: { userId } });

  return NextResponse.json({ reacted: !existing, count });
}
