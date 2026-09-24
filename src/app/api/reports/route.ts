import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportSchema } from "@/lib/validation";
import { resolveReportTarget } from "@/lib/reports";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a reason for the report" }, { status: 400 });
  }
  const { targetType, targetId, reason, details } = parsed.data;
  const reporterId = session.user.id;

  const target = await resolveReportTarget(targetType, targetId, reporterId);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.ownerId === reporterId) {
    return NextResponse.json({ error: "You can't report yourself" }, { status: 400 });
  }

  const data = {
    reportedUserId: target.ownerId,
    reason,
    details: details || null,
    contentSnapshot: target.contentSnapshot,
    mediaSnapshot: target.mediaSnapshot,
  };

  // Re-reporting refreshes the existing report and puts it back in the
  // queue if it had already been dismissed.
  const report = await prisma.report.upsert({
    where: { reporterId_targetType_targetId: { reporterId, targetType, targetId } },
    create: { reporterId, targetType, targetId, ...data },
    update: { ...data, status: "OPEN", resolvedAt: null },
  });

  const admins = await prisma.user.findMany({
    where: { isAdmin: true, id: { not: reporterId } },
    select: { id: true },
  });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        actorId: reporterId,
        type: "REPORT_SUBMITTED" as const,
      })),
    });
  }

  return NextResponse.json({ ok: true, id: report.id });
}
