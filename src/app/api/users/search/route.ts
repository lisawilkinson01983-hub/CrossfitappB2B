import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const RESULT_LIMIT = 6;
// A whole gym's roster, not a type-ahead suggestion list — generous enough
// to cover any real affiliate (this app has nowhere close to this many
// members at one gym yet), while still capping the query.
const GYM_RESULT_LIMIT = 300;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  // Lists everyone at a given affiliate (see New Message's "By gym" tab) —
  // an exact match against User.affiliateGym, a plain text field normally
  // kept consistent with the Gym it names via the same search-suggest
  // autocomplete used to set it (see ProfileSetupWizard), rather than a
  // foreign key to it.
  const gym = url.searchParams.get("gym")?.trim() ?? "";
  if (!q && !gym) {
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
      ...(gym ? { affiliateGym: gym } : { name: { contains: q } }),
    },
    select: { id: true, name: true, photo: true },
    orderBy: { name: "asc" },
    take: gym ? GYM_RESULT_LIMIT : RESULT_LIMIT,
  });

  return NextResponse.json({ users });
}
