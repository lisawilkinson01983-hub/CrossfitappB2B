import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const RESULT_LIMIT = 6;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ users: [] });
  }

  const blocked = await prisma.block.findMany({
    where: { OR: [{ blockerId: session.user.id }, { blockedId: session.user.id }] },
    select: { blockerId: true, blockedId: true },
  });
  const hiddenUserIds = blocked.flatMap((b) => [b.blockerId, b.blockedId]);

  const users = await prisma.user.findMany({
    where: {
      id: { not: session.user.id, notIn: hiddenUserIds },
      deletedAt: null,
      name: { contains: q },
    },
    select: { id: true, name: true, photo: true },
    orderBy: { name: "asc" },
    take: RESULT_LIMIT,
  });

  return NextResponse.json({ users });
}
