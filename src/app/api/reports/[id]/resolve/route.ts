import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeReportTarget } from "@/lib/reports";

const ACTIONS = ["dismiss", "remove", "suspend"] as const;
type Action = (typeof ACTIONS)[number];

// dismiss — no action needed.
// remove  — delete the reported content.
// suspend — delete the reported content (if any) and suspend its author.
// Each closes every open report on the same content (the review page shows
// them as one card), and "suspend" every open report against that user too,
// since they've all been dealt with in one go.
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
  const action: Action | null = ACTIONS.includes(body?.action) ? body.action : null;
  if (!action) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();

  const sameTarget = { targetType: report.targetType, targetId: report.targetId };

  if (action === "dismiss") {
    await prisma.report.updateMany({
      where: { OR: [{ id }, { status: "OPEN", ...sameTarget }] },
      data: { status: "DISMISSED", resolvedAt: now },
    });
    return NextResponse.json({ status: "DISMISSED" });
  }

  if (action === "suspend" && report.reportedUserId === session.user.id) {
    return NextResponse.json({ error: "You can't suspend your own account" }, { status: 400 });
  }

  await removeReportTarget(report.targetType, report.targetId);

  await prisma.$transaction([
    ...(action === "suspend"
      ? [prisma.user.update({ where: { id: report.reportedUserId }, data: { suspendedAt: now } })]
      : []),
    prisma.report.updateMany({
      where: {
        status: "OPEN",
        OR: action === "suspend" ? [sameTarget, { reportedUserId: report.reportedUserId }] : [sameTarget],
      },
      data: { status: "ACTIONED", resolvedAt: now },
    }),
    prisma.report.update({ where: { id }, data: { status: "ACTIONED", resolvedAt: now } }),
  ]);

  return NextResponse.json({ status: "ACTIONED" });
}
