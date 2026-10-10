import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { SettingsMenuLink } from "@/components/SettingsMenuLink";
import { SignOutButton } from "@/components/SignOutButton";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true, accountType: true, _count: { select: { referrals: true } } },
  });
  if (!user) redirect("/login");

  const [blockCount, muteCount, submissionCount, openReportCount, pendingVerificationCount, ownedCount, sharedCount] =
    await Promise.all([
      prisma.block.count({ where: { blockerId: session.user.id } }),
      prisma.mute.count({ where: { userId: session.user.id } }),
      prisma.event.count({ where: { submittedById: session.user.id } }),
      user.isAdmin ? prisma.report.count({ where: { status: "OPEN" } }) : 0,
      user.isAdmin
        ? prisma.user.count({ where: { accountType: "AFFILIATE", verificationRequestedAt: { not: null }, verifiedAt: null } })
        : 0,
      prisma.user.count({ where: { accountId: session.user.accountId } }),
      prisma.profileAccess.count({ where: { accountId: session.user.accountId } }),
    ]);
  const profileCount = ownedCount + sharedCount;

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <h1 className="mt-6 text-2xl font-bold">Settings</h1>

      <div className="mt-6">
        <SectionCard>
          <div className="flex flex-col gap-2">
            <SettingsMenuLink href="/settings/account" label="Account" description="Email, password, profile" />
            <SettingsMenuLink
              href="/settings/profiles"
              label="Profiles"
              description={`${profileCount} ${profileCount === 1 ? "profile" : "profiles"} on this login`}
            />
            <SettingsMenuLink
              href="/settings/invite"
              label="Invite Friends"
              description={`${user._count.referrals} ${user._count.referrals === 1 ? "person has" : "people have"} joined using your code`}
            />
            <SettingsMenuLink
              href="/settings/events"
              label="Event submissions"
              description="Track events you've submitted"
              count={submissionCount}
            />
            {user.accountType === "AFFILIATE" && (
              <SettingsMenuLink
                href="/settings/gym"
                label="Bookings"
                description="Where Intro Session/Drop-in requests go"
              />
            )}
            <SettingsMenuLink
              href="/settings/privacy"
              label="Privacy & Safety"
              description={`${blockCount} blocked · ${muteCount} muted`}
            />
            <SettingsMenuLink href="/settings/legal" label="Legal" description="Terms, privacy policy, guidelines" />
            {user.isAdmin && (
              <SettingsMenuLink
                href="/settings/admin"
                label="Admin"
                description="Reports, verification, notices, backups"
                count={openReportCount + pendingVerificationCount}
              />
            )}
            <SettingsMenuLink href="/settings/danger" label="Danger Zone" description="Delete your account" />
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 flex justify-center">
        <SignOutButton />
      </div>
    </main>
  );
}
