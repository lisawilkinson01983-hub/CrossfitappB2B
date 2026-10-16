import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLevels } from "@/lib/labels";
import { isProfileSetupComplete } from "@/lib/profileSetup";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { BackLink } from "@/components/BackLink";
import { AbilityEditor } from "@/components/AbilityEditor";
import { CompetitionStatsSection } from "./CompetitionStatsSection";

export default async function AbilityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");
  if (!isProfileSetupComplete(user)) redirect("/profile/setup");
  if (user.accountType !== "ATHLETE") redirect("/profile/edit");

  const [openResults, communityCupResults] = await Promise.all([
    prisma.openResult.findMany({ where: { userId: user.id }, orderBy: { year: "desc" } }),
    prisma.communityCupResult.findMany({ where: { userId: user.id }, orderBy: { year: "desc" } }),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <BackLink href="/profile/edit" className="mt-6">Edit profile</BackLink>

      <div className="mt-4">
        <SectionCard title="Ability">
          <AbilityEditor
            initial={{
              levels: parseLevels(user.levels),
              openLevel: user.openLevel,
              crossfitSinceYear: user.crossfitSinceYear ?? "",
              crossfitSinceMonth: user.crossfitSinceMonth ?? "",
            }}
          />
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard title="Competition stats">
          <CompetitionStatsSection
            initial={{
              openResults: openResults.map((r) => ({
                key: r.id,
                year: String(r.year),
                division: r.division,
                overallRank: r.overallRank != null ? String(r.overallRank) : "",
                countryRank: r.countryRank != null ? String(r.countryRank) : "",
              })),
              communityCupResults: communityCupResults.map((r) => ({
                key: r.id,
                year: String(r.year),
                division: r.division,
                rank: r.rank != null ? String(r.rank) : "",
                competition: r.competition ?? "",
              })),
            }}
          />
        </SectionCard>
      </div>
    </main>
  );
}
