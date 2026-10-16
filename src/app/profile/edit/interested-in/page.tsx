import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLookingFor } from "@/lib/labels";
import { isProfileSetupComplete } from "@/lib/profileSetup";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { BackLink } from "@/components/BackLink";
import { InterestedInEditorPage } from "./InterestedInEditorPage";

export default async function InterestedInPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");
  if (!isProfileSetupComplete(user)) redirect("/profile/setup");
  if (user.accountType !== "ATHLETE") redirect("/profile/edit");

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <BackLink href="/profile/edit" className="mt-6">Edit profile</BackLink>

      <div className="mt-4">
        <SectionCard title="Interested in">
          <InterestedInEditorPage
            initial={{
              lookingFor: parseLookingFor(user.lookingFor),
              isSingle: user.isSingle,
              showRelationshipStatus: user.showRelationshipStatus,
              showSingleBadge: user.showSingleBadge,
            }}
          />
        </SectionCard>
      </div>
    </main>
  );
}
