import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userId: mutedUserId } = await params;
  const userId = session.user.id;

  if (mutedUserId === userId) {
    return NextResponse.json({ error: "You can't mute yourself" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: mutedUserId } });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.mute.upsert({
    where: { userId_mutedUserId: { userId, mutedUserId } },
    create: { userId, mutedUserId },
    update: {},
  });

  return NextResponse.json({ muted: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userId: mutedUserId } = await params;

  await prisma.mute.deleteMany({ where: { userId: session.user.id, mutedUserId } });

  return NextResponse.json({ muted: false });
}
