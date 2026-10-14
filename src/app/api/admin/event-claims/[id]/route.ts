import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Admin approve/dismiss for a pending "claim this event" request (see Event.claimRequestedById). */
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

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event || !event.claimRequestedById) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.event.update({
    where: { id },
    data:
      action === "approve"
        ? { claimedById: event.claimRequestedById, claimRequestedById: null, claimRequestedAt: null }
        : { claimRequestedById: null, claimRequestedAt: null },
  });

  return NextResponse.json({ ok: true });
}
