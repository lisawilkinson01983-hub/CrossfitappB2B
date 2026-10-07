import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Who's viewed this story — author-only, same as Instagram's own "seen by" list. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const story = await prisma.story.findUnique({ where: { id }, select: { userId: true } });
  if (!story) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (story.userId !== session.user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const views = await prisma.storyView.findMany({
    where: { storyId: id },
    orderBy: { viewedAt: "desc" },
    include: { viewer: { select: { id: true, name: true, photo: true } } },
  });

  return NextResponse.json({
    views: views.map((v) => ({ ...v.viewer, viewedAt: v.viewedAt })),
  });
}
