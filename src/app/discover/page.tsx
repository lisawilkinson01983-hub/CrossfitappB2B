import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionOnboarding } from "@/components/SectionOnboarding";
import { AthletesSearch, type AthleteSearchParams } from "./AthletesSearch";
import { EventsList, type EventSearchParams } from "./EventsList";
import { AffiliatesList, type AffiliateSearchParams } from "./AffiliatesList";
import { TeammatesSearch, type TeammateSearchParams } from "./TeammatesSearch";

type SearchParams = AthleteSearchParams &
  EventSearchParams &
  AffiliateSearchParams &
  TeammateSearchParams & { view?: string };

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const sp = await searchParams;
  const view =
    sp.view === "events"
      ? "events"
      : sp.view === "affiliates"
        ? "affiliates"
        : sp.view === "teammates"
          ? "teammates"
          : "athletes";

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
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-b2b-ink/40">Discover</p>

      {/* Each tab renders its own DiscoverTabs row (see that component) —
          sharing one row with its own search-icon trigger, rather than this
          page drawing the tabs once above all four. Keyed on `view` so
          switching tabs always fully remounts the next one, rather than
          React reconciling two structurally similar trees (every tab's
          search form looks much the same) and reusing a client component
          instance in place — which otherwise let the previous tab's typed
          search text and open/closed filter state leak into the new tab
          instead of resetting. */}
      {view === "athletes" ? (
        <AthletesSearch key="athletes" sp={sp} currentUserId={session.user.id} />
      ) : view === "events" ? (
        <EventsList key="events" sp={sp} currentUserId={session.user.id} />
      ) : view === "affiliates" ? (
        <AffiliatesList key="affiliates" sp={sp} currentUserId={session.user.id} />
      ) : (
        <TeammatesSearch key="teammates" sp={sp} currentUserId={session.user.id} />
      )}
    </main>
  );
}
