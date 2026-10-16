import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLevels, parseLookingFor } from "@/lib/labels";
import { isProfileSetupComplete } from "@/lib/profileSetup";
import { ProfileSetupWizard } from "@/components/ProfileSetupWizard";

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function ProfileSetupPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  // Setup already done — this page is for first-time setup only, the
  // all-in-one form at /profile/edit handles everything after.
  if (isProfileSetupComplete(user)) redirect("/feed");

  return (
    <ProfileSetupWizard
      initial={{
        accountType: user.accountType,
        name: user.name,
        photo: user.photo,
        dateOfBirth: toDateInputValue(user.dateOfBirth),
        bio: user.bio ?? "",
        area: user.area ?? "",
        affiliateGym: user.affiliateGym ?? "",
        affiliateGymOther: user.affiliateGymOther ?? "",
        levels: parseLevels(user.levels),
        openLevel: user.openLevel,
        lookingFor: parseLookingFor(user.lookingFor),
      }}
    />
  );
}
