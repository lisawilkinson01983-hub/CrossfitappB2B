import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Retroactively finishes the job for private-event join posts created
 * before sharedToFeed started following event.isPrivate (see
 * /api/events/[id]/participate) — any already-posted feed post still
 * linked to a private event gets pulled from the feed now. Safe to run
 * more than once — each pass only finds what the last one left behind.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { count } = await prisma.post.updateMany({
    where: { sharedToFeed: true, linkedEvent: { isPrivate: true } },
    data: { sharedToFeed: false },
  });

  return NextResponse.json({ ok: true, hiddenCount: count });
}
