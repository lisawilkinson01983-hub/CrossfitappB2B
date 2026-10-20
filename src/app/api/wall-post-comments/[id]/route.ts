import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const comment = await prisma.wallPostComment.findUnique({
    where: { id },
    include: { wallPost: { select: { wallOwnerId: true } } },
  });
  // Deletable by its own author, or by the wall owner moderating their own wall.
  if (!comment || (comment.userId !== session.user.id && comment.wallPost.wallOwnerId !== session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.wallPostComment.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
