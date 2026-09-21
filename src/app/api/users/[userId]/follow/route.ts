import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userId: targetId } = await params;
  const followerId = session.user.id;

  if (targetId === followerId) {
    return NextResponse.json({ error: "You can't follow yourself" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const alreadyFollowing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId: targetId } },
  });
  if (alreadyFollowing) {
    return NextResponse.json({ status: "following" });
  }

  if (target.isPrivate) {
    await prisma.followRequest.upsert({
      where: { requesterId_targetId: { requesterId: followerId, targetId } },
      create: { requesterId: followerId, targetId, status: "PENDING" },
      update: { status: "PENDING" },
    });
    return NextResponse.json({ status: "pending" });
  }

  await prisma.follow.create({ data: { followerId, followingId: targetId } });
  return NextResponse.json({ status: "following" });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userId: targetId } = await params;
  const followerId = session.user.id;

  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId: targetId } },
  });
  if (follow) {
    await prisma.follow.delete({ where: { id: follow.id } });
    return NextResponse.json({ status: "none" });
  }

  const pending = await prisma.followRequest.findUnique({
    where: { requesterId_targetId: { requesterId: followerId, targetId } },
  });
  if (pending && pending.status === "PENDING") {
    await prisma.followRequest.update({ where: { id: pending.id }, data: { status: "CANCELLED" } });
  }

  return NextResponse.json({ status: "none" });
}
