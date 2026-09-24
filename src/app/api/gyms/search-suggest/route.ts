import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const RESULT_LIMIT = 6;

/** Live "as you type" suggestions for Discover's affiliate search bar — distinct from /api/gyms/check-duplicate, which flags near-duplicates during submission. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ matches: [] });
  }

  const matches = await prisma.gym.findMany({
    where: { status: "APPROVED", name: { contains: q } },
    select: { id: true, name: true, address: true },
    orderBy: { name: "asc" },
    take: RESULT_LIMIT,
  });

  return NextResponse.json({ matches });
}
