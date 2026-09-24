import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { BlockMuteControls } from "@/components/BlockMuteControls";
import { ChangeEmailForm } from "./ChangeEmailForm";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { DeleteAccountForm } from "./DeleteAccountForm";
import { InviteCodeCard } from "./InviteCodeCard";
import { generateUniqueInviteCode } from "@/lib/inviteCode";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPrivate: true, isAdmin: true, inviteCode: true, _count: { select: { referrals: true } } },
  });
  if (!user) redirect("/login");

  // Self-healing fallback — every new signup gets a code already, and
  // scripts/backfill-invite-codes.js covers accounts from before that
  // shipped, but this keeps the page correct even if neither has run yet.
  let inviteCode = user.inviteCode;
  if (!inviteCode) {
    inviteCode = await generateUniqueInviteCode();
    await prisma.user.update({ where: { id: session.user.id }, data: { inviteCode } });
  }

  const [blocks, mutes, openReportCount] = await Promise.all([
    prisma.block.findMany({
      where: { blockerId: session.user.id },
      include: { blocked: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.mute.findMany({
      where: { userId: session.user.id },
      include: { mutedUser: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    user.isAdmin ? prisma.report.count({ where: { status: "OPEN" } }) : 0,
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <h1 className="mt-6 text-2xl font-bold">Settings</h1>

      <div className="mt-6 flex flex-col gap-6">
        <SectionCard
          title="Account"
          action={
            <Link href="/profile/edit" className="text-sm text-b2b-pink underline">
              Edit your profile
            </Link>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-b2b-purple/10 bg-b2b-bg p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">
                Change email
              </h3>
              <div className="mt-2">
                <ChangeEmailForm />
              </div>
            </div>

            <div className="rounded-lg border border-b2b-purple/10 bg-b2b-bg p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">
                Change password
              </h3>
              <div className="mt-2">
                <ChangePasswordForm />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Invite Friends">
          <InviteCodeCard code={inviteCode} referralCount={user._count.referrals} />
        </SectionCard>

        {user.isAdmin && (
          <SectionCard title="Admin">
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/reports/review" className="text-b2b-purple underline">
                Review reports{openReportCount > 0 ? ` (${openReportCount})` : ""}
              </Link>
              <Link href="/leaderboard" className="text-b2b-purple underline">
                Activity leaderboard
              </Link>
              {/* A plain link rather than next/link — it's a file download, not a page. */}
              <a href="/api/admin/backup" className="text-b2b-purple underline">
                Download database backup
              </a>
              <p className="text-xs text-b2b-ink/50">
                Save one weekly (and before big changes) somewhere safe like Google Drive. Photos aren't
                included.
              </p>
            </div>
          </SectionCard>
        )}

        <SectionCard title="Privacy &amp; Safety">
          <p className="text-sm text-b2b-ink/60">
            Your profile is currently <strong>{user.isPrivate ? "private" : "public"}</strong>.{" "}
            <Link href="/profile/edit" className="text-b2b-pink underline">
              Change this
            </Link>
          </p>

          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded-lg border border-b2b-purple/10 bg-b2b-bg p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">
                Blocked users ({blocks.length})
              </h3>
              {blocks.length === 0 ? (
                <p className="mt-1 text-sm text-b2b-ink/40">No one blocked.</p>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {blocks.map((b) => (
                    <div key={b.id} className="flex items-center justify-between text-sm">
                      <span>{b.blocked.name}</span>
                      <BlockMuteControls
                        targetUserId={b.blocked.id}
                        initialBlocked={true}
                        initialMuted={false}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-b2b-purple/10 bg-b2b-bg p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">
                Muted accounts ({mutes.length})
              </h3>
              {mutes.length === 0 ? (
                <p className="mt-1 text-sm text-b2b-ink/40">No one muted.</p>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {mutes.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <span>{m.mutedUser.name}</span>
                      <BlockMuteControls
                        targetUserId={m.mutedUser.id}
                        initialBlocked={false}
                        initialMuted={true}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Legal">
          <div className="flex flex-col gap-2 text-sm">
            <Link href="/terms" className="text-b2b-pink underline">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-b2b-pink underline">
              Privacy Policy
            </Link>
            <Link href="/guidelines" className="text-b2b-pink underline">
              Community Guidelines
            </Link>
          </div>
        </SectionCard>

        <SectionCard title="Danger Zone">
          <DeleteAccountForm />
        </SectionCard>
      </div>
    </main>
  );
}
