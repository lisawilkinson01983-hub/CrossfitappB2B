import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** "Share to feed" on the results share-confirm screen — one Post per result, even for a team (the submitter posts it once; the feed card reads the roster via result.teamId). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const result = await prisma.eventResult.findUnique({ where: { id }, select: { id: true, loggedByUserId: true } });
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (result.loggedByUserId !== session.user.id) {
    return NextResponse.json({ error: "Not your result" }, { status: 403 });
  }

  const existing = await prisma.post.findFirst({ where: { linkedEventResultId: id }, select: { id: true } });
  if (existing) return NextResponse.json({ postId: existing.id });

  const post = await prisma.post.create({
    data: {
      userId: session.user.id,
      type: "EVENT_RESULT",
      linkedEventResultId: id,
      sharedToFeed: true,
    },
  });

  return NextResponse.json({ postId: post.id });
}
