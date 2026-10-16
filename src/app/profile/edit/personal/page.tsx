import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLookingFor, parseLevels, parseDisplayedPbs } from "@/lib/labels";
import { PB_FIELDS } from "@/lib/validation";
import { OTHER_GYM, UNAFFILIATED } from "@/lib/gyms";
import { isProfileSetupComplete } from "@/lib/profileSetup";
import type { Country } from "@/lib/countries";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { BackLink } from "@/components/BackLink";
import { PersonalInfoForm } from "./PersonalInfoForm";

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function PersonalInfoPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [user, approvedGyms] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.gym.findMany({ where: { status: "APPROVED" }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!user) redirect("/login");
  if (!isProfileSetupComplete(user)) redirect("/profile/setup");

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
      <NavBar />
      <BackLink href="/profile/edit" className="mt-6">Edit profile</BackLink>

      <div className="mt-4">
        <SectionCard title="Personal info">
          <PersonalInfoForm
            gymOptions={gymOptions}
            initial={{
              name: user.name,
              photo: user.photo,
              accountType: user.accountType,
              website: user.website ?? "",
              verificationRequested: user.verificationRequestedAt != null && user.verifiedAt == null,
              isVerified: user.verifiedAt != null,
              bio: user.bio ?? "",
              dateOfBirth: toDateInputValue(user.dateOfBirth),
              gender: user.gender ?? "",
              area: user.area ?? "",
              // Cast: country is a plain String column (see prisma/schema.prisma), not
              // a Prisma enum, so nothing at the type level guarantees it's one of
              // COUNTRIES — true for every real profile since this field only accepts
              // values from that list.
              country: (user.country as Country | null) ?? "",
              affiliateGym: initialAffiliateGym,
              affiliateGymOther: initialAffiliateGymOther,
              showAge: user.showAge,
              isPrivate: user.isPrivate,
              // Not edited on this page — carried forward unchanged, since
              // the underlying PATCH /api/profile route replaces a user's
              // full profile each time (see PersonalInfoForm).
              levels: parseLevels(user.levels),
              openLevel: user.openLevel,
              crossfitSinceYear: user.crossfitSinceYear ?? "",
              crossfitSinceMonth: user.crossfitSinceMonth ?? "",
              lookingFor: parseLookingFor(user.lookingFor),
              isSingle: user.isSingle,
              showRelationshipStatus: user.showRelationshipStatus,
              showSingleBadge: user.showSingleBadge,
              pbs: Object.fromEntries(PB_FIELDS.map((field) => [field, user[field] ?? ""])) as Record<
                (typeof PB_FIELDS)[number],
                number | ""
              >,
              displayedPbs: parseDisplayedPbs(user.displayedPbs),
            }}
          />
        </SectionCard>
      </div>
    </main>
  );
}
