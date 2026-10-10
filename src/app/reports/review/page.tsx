import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { ReportModerationCard } from "@/components/ReportModerationCard";
import { resolveReportTarget } from "@/lib/reports";
import { BackLink } from "@/components/BackLink";

export default async function ReportReviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) notFound();

  const open = await prisma.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    include: {
      reporter: { select: { id: true, name: true } },
      reportedUser: {
        select: { id: true, name: true, account: { select: { email: true, suspendedAt: true } } },
      },
    },
  });

  // One card per reported thing, oldest first — several people reporting
  // the same post shouldn't mean acting on it several times.
  const byTarget = new Map<string, typeof open>();
  for (const report of open) {
    const key = `${report.targetType}:${report.targetId}`;
    byTarget.set(key, [...(byTarget.get(key) ?? []), report]);
  }

  const cards = await Promise.all(
    [...byTarget.values()].map(async ([first, ...rest]) => {
      // Messages resolve only for a participant, so look them up as the reporter.
      const target = await resolveReportTarget(first.targetType, first.targetId, first.reporterId);
      return {
        id: first.id,
        targetType: first.targetType,
        reason: first.reason,
        details: first.details,
        contentSnapshot: first.contentSnapshot,
        mediaSnapshot: first.mediaSnapshot,
        // Null once the content's gone — deleted by its author since.
        href: target?.href ?? null,
        createdAt: first.createdAt,
        reporter: first.reporter,
        reportedUser: {
          id: first.reportedUser.id,
          name: first.reportedUser.name,
          email: first.reportedUser.account?.email ?? "",
          suspendedAt: first.reportedUser.account?.suspendedAt ?? null,
        },
        otherReportCount: rest.length,
      };
    })
  );

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <BackLink href="/settings/admin" className="mt-6">Back to settings</BackLink>

      <div className="mt-4">
        <SectionCard title={`${cards.length} ${cards.length === 1 ? "report" : "reports"} to review`}>
          <p className="mb-3 text-sm text-b2b-ink/50">
            App store rules expect reports to be acted on within 24 hours.
          </p>
          {cards.length === 0 ? (
            <p className="text-b2b-ink/40">Nothing waiting on review.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {cards.map((report) => (
                <ReportModerationCard key={report.id} report={report} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
