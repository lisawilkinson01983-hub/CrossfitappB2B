import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: noticeId } = await params;

  const notice = await prisma.eventNotice.findUnique({ where: { id: noticeId } });
  if (!notice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.eventNoticeLike.findUnique({
    where: { userId_noticeId: { userId: session.user.id, noticeId } },
  });

  if (existing) {
    await prisma.eventNoticeLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.eventNoticeLike.create({ data: { userId: session.user.id, noticeId } });
  }

  const count = await prisma.eventNoticeLike.count({ where: { noticeId } });

  return NextResponse.json({ liked: !existing, count });
}
