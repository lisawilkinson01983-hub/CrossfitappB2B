import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Admin approve/dismiss for an affiliate account's "verify me as the owner" request. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const action = body?.action === "approve" ? "approve" : body?.action === "dismiss" ? "dismiss" : null;
  if (!action) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.accountType !== "AFFILIATE") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id },
    data:
      action === "approve"
        ? { verifiedAt: new Date() }
        : { verificationRequestedAt: null },
  });

  // Now that they're a confirmed owner, let their own profile stand in for
  // the gym's directory entry (see Gym.claimedById) instead of just the
  // static seed/admin-entered page. Releases any gym they'd previously
  // claimed first, in case they've since switched which gym they run; only
  // claims the new one if nobody else already has, which would mean two
  // affiliates claiming the same gym and needs a human to sort out (e.g. via
  // Prisma Studio) rather than silently picking one.
  if (action === "approve" && target.affiliateGym) {
    await prisma.$transaction([
      prisma.gym.updateMany({ where: { claimedById: target.id }, data: { claimedById: null } }),
      prisma.gym.updateMany({
        where: { name: target.affiliateGym, status: "APPROVED", claimedById: null },
        data: { claimedById: target.id },
      }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
