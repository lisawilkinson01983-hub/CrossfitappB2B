import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const request = await prisma.followRequest.findUnique({ where: { id } });
  if (!request || request.targetId !== session.user.id || request.status !== "PENDING") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.followRequest.update({ where: { id }, data: { status: "ACCEPTED" } }),
    prisma.follow.upsert({
      where: {
        followerId_followingId: { followerId: request.requesterId, followingId: request.targetId },
      },
      create: { followerId: request.requesterId, followingId: request.targetId },
      update: {},
    }),
  ]);

  return NextResponse.json({ ok: true });
}
