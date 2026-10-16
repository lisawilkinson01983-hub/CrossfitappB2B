import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Retroactively finishes the job for accounts deleted before this content
 * was switched from "redact to [deleted]" to "remove outright" (see
 * /api/account/delete) — any already-deleted (User.deletedAt set) profile's
 * leftover comments/notices still sitting around (as a "[deleted]"
 * placeholder, or just never cleaned up) get fully removed now. Safe to
 * run more than once — each pass only finds what the last one left behind.
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

  const deletedUsers = await prisma.user.findMany({ where: { deletedAt: { not: null } }, select: { id: true } });
  const userIds = deletedUsers.map((u) => u.id);

  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, deletedUserCount: 0, removed: {} });
  }

  const [comments, eventNoticeComments, eventNotices, workoutComments, pbComments] = await prisma.$transaction([
    prisma.comment.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.eventNoticeComment.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.eventNotice.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.workoutComment.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.pbComment.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { profileUserId: { in: userIds } }] } }),
  ]);

  return NextResponse.json({
    ok: true,
    deletedUserCount: userIds.length,
    removed: {
      comments: comments.count,
      eventNoticeComments: eventNoticeComments.count,
      eventNotices: eventNotices.count,
      workoutComments: workoutComments.count,
      pbComments: pbComments.count,
    },
  });
}
