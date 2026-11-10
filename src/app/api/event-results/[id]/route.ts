import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Deletes a logged result — scoped to the caller's own row only, even on a
 * team result (every member has their own independent EventResult row
 * sharing the team's placement data, same as how accepting a teammate tag
 * creates its own row rather than editing anyone else's). Cascades to any
 * feed post made from it (see Post.linkedEventResultId's onDelete: Cascade).
 * Lets someone undo a mistaken or unwanted result themselves, without
 * needing it fixed by hand in the database.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const result = await prisma.eventResult.findUnique({ where: { id }, select: { userId: true } });
  if (!result || result.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.eventResult.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
