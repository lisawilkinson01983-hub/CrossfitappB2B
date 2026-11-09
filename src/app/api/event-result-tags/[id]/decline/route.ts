import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** "Not me / decline" — leaves the tagged user's profile untouched. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const tag = await prisma.eventResultTag.findUnique({ where: { id }, select: { taggedUserId: true, status: true } });
  if (!tag) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (tag.taggedUserId !== session.user.id) {
    return NextResponse.json({ error: "Not your tag" }, { status: 403 });
  }

  if (tag.status === "PENDING") {
    await prisma.eventResultTag.update({ where: { id }, data: { status: "DECLINED" } });
  }
  return NextResponse.json({ ok: true });
}
