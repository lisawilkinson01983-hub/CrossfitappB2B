import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProfileSetupComplete } from "@/lib/profileSetup";
import { NavBar } from "@/components/NavBar";
import { BackLink } from "@/components/BackLink";
import { SectionCard } from "@/components/SectionCard";
import { SectionOnboarding } from "@/components/SectionOnboarding";
import { ProfileEditMenuLink } from "@/components/ProfileEditMenuLink";
import { PersonIcon } from "@/components/PersonIcon";
import { BarbellIcon } from "@/components/BarbellIcon";
import { MedalIcon } from "@/components/MedalIcon";
import { SearchIcon } from "@/components/SearchIcon";

export default async function EditProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      accountType: true,
      area: true,
      affiliateGym: true,
      levels: true,
      lookingFor: true,
      hasSeenOnboarding: true,
    },
  });
  if (!user) redirect("/login");

  // First-time setup happens in the wizard now — this page is only for
  // editing an already-complete profile.
  if (!isProfileSetupComplete(user)) redirect("/profile/setup");

  const isAthlete = user.accountType === "ATHLETE";

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      {!user.hasSeenOnboarding && (
        <SectionOnboarding
          section="welcome"
          finishLabel="Let's go!"
          cards={[
            {
              emoji: "🎉",
              title: "Welcome to Box 2 Box!",
              body: "Here's a quick tour to help you find your way around.",
            },
            {
              emoji: "👤",
              title: "Profile",
              body: "Manage your profile and settings, and track your personal bests below.",
            },
          ]}
        />
      )}
      <NavBar />
      <BackLink href="/profile" className="mt-6">Back to profile</BackLink>
      <div className="mt-4">
        <SectionCard title="Edit profile">
          <div className="flex flex-col gap-2">
            <ProfileEditMenuLink
              href="/profile/edit/personal"
              icon={<PersonIcon className="h-5 w-5" />}
              label="Personal info"
              description="Photo, name, bio, area, gym"
            />
            {isAthlete && (
              <>
                <ProfileEditMenuLink
                  href="/profile/edit/pbs"
                  icon={<BarbellIcon className="h-5 w-5" />}
                  label="PBs"
                  description="Key lifts, featured on your profile"
                />
                <ProfileEditMenuLink
                  href="/profile/edit/ability"
                  icon={<MedalIcon className="h-5 w-5" />}
                  label="Ability"
                  description="Level, Open badge, competition stats"
                />
                <ProfileEditMenuLink
                  href="/profile/edit/interested-in"
                  icon={<SearchIcon className="h-5 w-5" />}
                  label="Interested in"
                  description="Search tags, relationship status"
                />
              </>
            )}
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
