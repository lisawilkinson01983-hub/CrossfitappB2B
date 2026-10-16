import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDisplayedPbs } from "@/lib/labels";
import { PB_FIELDS } from "@/lib/validation";
import { isProfileSetupComplete } from "@/lib/profileSetup";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { BackLink } from "@/components/BackLink";
import { PbsEditorPage } from "./PbsEditorPage";

export default async function PbsPage() {
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
        <SectionCard title="PBs">
          <PbsEditorPage
            initial={{
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
