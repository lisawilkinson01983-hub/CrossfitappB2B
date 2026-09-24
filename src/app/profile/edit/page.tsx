import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDisplayedPbs, parseLookingFor } from "@/lib/labels";
import { PB_FIELDS } from "@/lib/validation";
import { OTHER_GYM, UNAFFILIATED } from "@/lib/gyms";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { SectionOnboarding } from "@/components/SectionOnboarding";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { EditProfileForm } from "./EditProfileForm";

export default async function EditProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [user, approvedGyms] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.gym.findMany({ where: { status: "APPROVED" }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!user) redirect("/login");

  const gymOptions = [...approvedGyms.map((g) => g.name), UNAFFILIATED];

  // Older data (from before the gym field was locked to a fixed list, or a
  // gym that's since been renamed/removed) may hold text that isn't one of
  // the current selectable values — treat it as "Other" with that old text
  // preserved as the suggestion, rather than breaking the form.
  const isKnownGymValue =
    user.affiliateGym != null &&
    (gymOptions.includes(user.affiliateGym) || user.affiliateGym === OTHER_GYM);
  const initialAffiliateGym = user.affiliateGym == null ? "" : isKnownGymValue ? user.affiliateGym : OTHER_GYM;
  const initialAffiliateGymOther = isKnownGymValue
    ? (user.affiliateGymOther ?? "")
    : (user.affiliateGym ?? "");

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
              body: "Here's a quick tour to help you find your way around. First, let's complete your profile before continuing.",
            },
            {
              emoji: "👤",
              title: "Profile",
              body: "Manage your profile and settings, and track your personal bests. Fill in your details below to get started.",
            },
          ]}
        />
      )}
      <NavBar />
      <div className="mt-6">
        <SectionCard title="Edit profile">
          <EditProfileForm
            gymOptions={gymOptions}
            initial={{
              name: user.name,
              photo: user.photo,
              accountType: user.accountType,
              verificationRequested: user.verificationRequestedAt != null && user.verifiedAt == null,
              isVerified: user.verifiedAt != null,
              bio: user.bio ?? "",
              age: user.age ?? "",
              gender: user.gender ?? "",
              area: user.area ?? "",
              affiliateGym: initialAffiliateGym,
              affiliateGymOther: initialAffiliateGymOther,
              level: user.level ?? "",
              crossfitSinceYear: user.crossfitSinceYear ?? "",
              crossfitSinceMonth: user.crossfitSinceMonth ?? "",
              lookingFor: parseLookingFor(user.lookingFor),
              showLookingFor: user.showLookingFor,
              isSingle: user.isSingle,
              showRelationshipStatus: user.showRelationshipStatus,
              showSingleBadge: user.showSingleBadge,
              showAge: user.showAge,
              isPrivate: user.isPrivate,
              pbs: Object.fromEntries(PB_FIELDS.map((field) => [field, user[field] ?? ""])) as Record<
                (typeof PB_FIELDS)[number],
                number | ""
              >,
              displayedPbs: parseDisplayedPbs(user.displayedPbs),
            }}
          />
        </SectionCard>

        <div className="mt-6">
          <SectionCard title="Appearance">
            <p className="mb-3 text-sm text-b2b-ink/60">Choose the app&apos;s color theme.</p>
            <ThemeSwitcher initialTheme={user.theme} />
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
