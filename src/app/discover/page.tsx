import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionOnboarding } from "@/components/SectionOnboarding";
import { AthletesSearch, type AthleteSearchParams } from "./AthletesSearch";
import { EventsList, type EventSearchParams } from "./EventsList";
import { AffiliatesList, type AffiliateSearchParams } from "./AffiliatesList";

type SearchParams = AthleteSearchParams & EventSearchParams & AffiliateSearchParams & { view?: string };

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const sp = await searchParams;
  const view = sp.view === "events" ? "events" : sp.view === "affiliates" ? "affiliates" : "athletes";

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { hasSeenDiscoverTour: true },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      {!currentUser?.hasSeenDiscoverTour && (
        <SectionOnboarding
          section="discover"
          cards={[
            {
              emoji: "🔍",
              title: "Discover",
              body: "Search for fellow athletes, upcoming events, and affiliate gyms — follow people you train with, and find your next competition.",
            },
          ]}
        />
      )}
      <NavBar />
      <h1 className="mt-6 text-2xl font-bold">Discover</h1>

      <div className="mt-4 flex gap-4 border-b border-gray-200 text-sm font-medium">
        <Link
          href="/discover?view=athletes"
          className={`pb-2 ${view === "athletes" ? "border-b-2 border-b2b-purple text-b2b-purple" : "text-gray-500"}`}
        >
          Athletes
        </Link>
        <Link
          href="/discover?view=events"
          className={`pb-2 ${view === "events" ? "border-b-2 border-b2b-purple text-b2b-purple" : "text-gray-500"}`}
        >
          Events
        </Link>
        <Link
          href="/discover?view=affiliates"
          className={`pb-2 ${view === "affiliates" ? "border-b-2 border-b2b-purple text-b2b-purple" : "text-gray-500"}`}
        >
          Affiliates
        </Link>
      </div>

      {view === "athletes" ? (
        <AthletesSearch sp={sp} currentUserId={session.user.id} />
      ) : view === "events" ? (
        <EventsList sp={sp} currentUserId={session.user.id} />
      ) : (
        <AffiliatesList sp={sp} currentUserId={session.user.id} />
      )}
    </main>
  );
}
