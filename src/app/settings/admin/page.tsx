import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) notFound();

  const [openReportCount, pendingVerificationCount] = await Promise.all([
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.user.count({ where: { accountType: "AFFILIATE", verificationRequestedAt: { not: null }, verifiedAt: null } }),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <Link href="/settings" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Settings
      </Link>

      <div className="mt-4">
        <SectionCard title="Admin">
          <div className="flex flex-col gap-2">
            <AdminLink href="/reports/review" label="Review reports" count={openReportCount} />
            <AdminLink href="/leaderboard" label="Activity leaderboard" />
            <AdminLink
              href="/admin/verification-requests"
              label="Verification requests"
              count={pendingVerificationCount}
            />
            <AdminLink href="/admin/notices" label="Send a notice" />
            <AdminLink href="/admin/brand-access" label="Box 2 Box profile access" />
            {/* A plain <a>, not AdminLink/next/link — it's a file download, not a page. */}
            <a
              href="/api/admin/backup"
              className="flex items-center justify-between rounded-lg border border-b2b-purple/10 bg-b2b-bg px-4 py-2.5 text-sm font-medium text-b2b-ink transition hover:border-b2b-pink/40 hover:bg-b2b-pink/5"
            >
              Download database backup
            </a>
            <p className="mt-1 text-xs text-b2b-ink/50">
              Save one weekly (and before big changes) somewhere safe like Google Drive. Photos aren't included.
            </p>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}

function AdminLink({ href, label, count }: { href: string; label: string; count?: number }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-b2b-purple/10 bg-b2b-bg px-4 py-2.5 text-sm font-medium text-b2b-ink transition hover:border-b2b-pink/40 hover:bg-b2b-pink/5"
    >
      {label}
      {!!count && (
        <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-b2b-pink px-1.5 text-xs font-medium text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
