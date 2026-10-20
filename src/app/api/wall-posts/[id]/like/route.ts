import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: wallPostId } = await params;

  const post = await prisma.wallPost.findUnique({ where: { id: wallPostId } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.wallPostLike.findUnique({
    where: { userId_wallPostId: { userId: session.user.id, wallPostId } },
  });

  if (existing) {
    await prisma.wallPostLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.wallPostLike.create({ data: { userId: session.user.id, wallPostId } });
  }

  const count = await prisma.wallPostLike.count({ where: { wallPostId } });

  return NextResponse.json({ liked: !existing, count });
}
