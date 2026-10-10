import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { generateUniqueInviteCode } from "@/lib/inviteCode";
import { InviteCodeCard } from "./InviteCodeCard";
import { BackLink } from "@/components/BackLink";

export default async function InviteSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { inviteCode: true, _count: { select: { referrals: true } } },
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

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <BackLink href="/settings" className="mt-6">Settings</BackLink>

      <div className="mt-4">
        <SectionCard title="Invite Friends">
          <InviteCodeCard code={inviteCode} referralCount={user._count.referrals} />
        </SectionCard>
      </div>
    </main>
  );
}
