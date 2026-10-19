import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeDeletedUserContent } from "@/lib/deletedUserCleanup";

/**
 * Retroactively finishes the job for every already-deleted (User.deletedAt
 * set) profile — whether it was deleted before content was switched from
 * "redact to [deleted]" to "remove outright" (see /api/account/delete), or
 * before removeDeletedUserContent covered a given category at all (e.g. the
 * reaction/workout-partner/team-roster/story gaps it closed later). Safe to
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

  const removed = await removeDeletedUserContent(userIds);

  return NextResponse.json({ ok: true, deletedUserCount: userIds.length, removed });
}
