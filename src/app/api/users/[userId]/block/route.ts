import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userId: blockedId } = await params;
  const blockerId = session.user.id;

  if (blockedId === blockerId) {
    return NextResponse.json({ error: "You can't block yourself" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: blockedId } });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    }),
    // Remove any follow relationship between them, in either direction.
    prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: blockerId, followingId: blockedId },
          { followerId: blockedId, followingId: blockerId },
        ],
      },
    }),
    // And any pending follow request between them, in either direction.
    prisma.followRequest.updateMany({
      where: {
        status: "PENDING",
        OR: [
          { requesterId: blockerId, targetId: blockedId },
          { requesterId: blockedId, targetId: blockerId },
        ],
      },
      data: { status: "CANCELLED" },
    }),
  ]);

  return NextResponse.json({ blocked: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userId: blockedId } = await params;

  await prisma.block.deleteMany({ where: { blockerId: session.user.id, blockedId } });

  return NextResponse.json({ blocked: false });
}
