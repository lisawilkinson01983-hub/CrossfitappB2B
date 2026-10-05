import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { ProfileSwitcherList } from "./ProfileSwitcherList";
import { AddProfileForm } from "./AddProfileForm";

export default async function ProfilesSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const accountId = session.user.accountId;

  const [owned, shared] = await Promise.all([
    prisma.user.findMany({
      where: { accountId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, photo: true, accountType: true },
    }),
    // Profiles owned by a different Account but shared with this one — e.g.
    // the Box 2 Box brand profile shared across more than one admin login
    // (see ProfileAccess).
    prisma.profileAccess.findMany({
      where: { accountId },
      orderBy: { createdAt: "asc" },
      select: { profile: { select: { id: true, name: true, photo: true, accountType: true } } },
    }),
  ]);

  const profiles = [
    ...owned.map((p) => ({ ...p, shared: false })),
    ...shared.map(({ profile }) => ({ ...profile, shared: true })),
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <Link href="/settings" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Settings
      </Link>

      <div className="mt-4 flex flex-col gap-4">
        <SectionCard title="Your profiles">
          <p className="mb-3 text-sm text-b2b-ink/50">
            One login, more than one profile — e.g. an athlete profile and the affiliate profile for a gym you
            run. Switch between them any time.
          </p>
          <ProfileSwitcherList profiles={profiles} activeProfileId={session.user.id} />
        </SectionCard>

        <SectionCard title="Add a profile">
          <AddProfileForm />
        </SectionCard>
      </div>
    </main>
  );
}
