import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteAccountId } from "@/lib/siteAccount";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { GrantAccessForm } from "./GrantAccessForm";
import { RevokeAccessButton } from "./RevokeAccessButton";

export default async function BrandAccessPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) notFound();

  const profileId = await getSiteAccountId();
  const [grants, siteProfile] = await Promise.all([
    profileId
      ? prisma.profileAccess.findMany({
          where: { profileId },
          orderBy: { createdAt: "asc" },
          include: { account: { select: { id: true, email: true } } },
        })
      : Promise.resolve([]),
    profileId
      ? prisma.user.findUnique({ where: { id: profileId }, select: { name: true, account: { select: { email: true } } } })
      : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <Link href="/settings/admin" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to settings
      </Link>

      <h1 className="mt-4 text-2xl font-bold">Box 2 Box profile access</h1>
      <p className="mt-1 text-sm text-b2b-ink/60">
        Admins listed here can switch to the Box 2 Box profile from their own login (see Settings → Profiles),
        without sharing its password. The brand account itself keeps working as normal — auto-follow on
        signup and admin broadcast notices still come from it either way.
      </p>

      {!profileId && (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          The Box 2 Box brand account (ADMIN_USER_EMAIL) isn&apos;t configured, so there&apos;s nothing to
          grant access to yet.
        </p>
      )}

      {profileId && siteProfile && (
        <>
          <p className="mt-4 rounded bg-b2b-purple/5 px-3 py-2 text-sm">
            This resolves to the profile <span className="font-medium">&ldquo;{siteProfile.name}&rdquo;</span>,
            owned by the login <span className="font-medium">{siteProfile.account?.email}</span>. If that
            email isn&apos;t the dedicated Box 2 Box account you expect, fix <code>ADMIN_USER_EMAIL</code> in
            Railway before granting anyone access here — otherwise you&apos;d be sharing a real person&apos;s
            own account instead.
          </p>

          <div className="mt-6">
            <SectionCard title="Grant access">
              <p className="mb-3 text-sm text-b2b-ink/50">
                The email must already be an admin account on Box 2 Box.
              </p>
              <GrantAccessForm />
            </SectionCard>
          </div>

          <div className="mt-6">
            <SectionCard title={`Current access (${grants.length})`}>
              {grants.length === 0 ? (
                <p className="text-sm text-b2b-ink/40">No one else has been granted access yet.</p>
              ) : (
                <div className="flex flex-col divide-y divide-b2b-purple/10">
                  {grants.map((grant) => (
                    <div key={grant.id} className="flex items-center justify-between gap-3 py-3">
                      <p className="truncate text-sm">{grant.account.email}</p>
                      <RevokeAccessButton accountId={grant.account.id} email={grant.account.email} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </main>
  );
}
