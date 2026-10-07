import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activeStoryWhere } from "@/lib/stories";

/** Records that the caller has seen this story — idempotent, and a no-op for the author viewing their own. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const story = await prisma.story.findFirst({ where: { id, ...activeStoryWhere() }, select: { userId: true } });
  if (!story) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (story.userId === session.user.id) {
    return NextResponse.json({ ok: true });
  }

  await prisma.storyView.upsert({
    where: { storyId_viewerId: { storyId: id, viewerId: session.user.id } },
    update: {},
    create: { storyId: id, viewerId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
