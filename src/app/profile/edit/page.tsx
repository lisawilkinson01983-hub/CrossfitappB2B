import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLookingFor } from "@/lib/labels";
import { PB_FIELDS } from "@/lib/validation";
import { AFFILIATE_GYM_VALUES, OTHER_GYM } from "@/lib/gyms";
import { NavBar } from "@/components/NavBar";
import { EditProfileForm } from "./EditProfileForm";

export default async function EditProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  // Older data (from before the gym field was locked to a fixed list) may
  // hold free text that isn't one of the current values — treat it as
  // "Other" with that old text preserved as the suggestion, rather than
  // breaking the form.
  const isKnownGymValue =
    user.affiliateGym != null && (AFFILIATE_GYM_VALUES as readonly string[]).includes(user.affiliateGym);
  const initialAffiliateGym = user.affiliateGym == null ? "" : isKnownGymValue ? user.affiliateGym : OTHER_GYM;
  const initialAffiliateGymOther = isKnownGymValue
    ? (user.affiliateGymOther ?? "")
    : (user.affiliateGym ?? "");

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <NavBar />
      <h1 className="mt-6 text-2xl font-bold">Edit profile</h1>
      <EditProfileForm
        initial={{
          name: user.name,
          photo: user.photo,
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
        }}
      />
    </main>
  );
}
