import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { EventNoticesPanel } from "@/components/EventNoticesPanel";
import { InterestedAthletesCarousel, type InterestedAthlete } from "@/components/InterestedAthletesCarousel";
import { parseLevels } from "@/lib/labels";
import { assertEventVisible } from "@/lib/eventVisibility";
import { BackLink } from "@/components/BackLink";

export default async function FindTeammatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      interests: {
        where: { userId: { not: session.user.id } },
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              photo: true,
              levels: true,
              area: true,
              affiliateGym: true,
              isSingle: true,
              showSingleBadge: true,
            },
          },
        },
      },
    },
  });
  if (!event) notFound();
  if (!(await assertEventVisible(event, session.user.id))) notFound();

  const athletes: InterestedAthlete[] = event.interests.map((interest) => ({
    id: interest.user.id,
    name: interest.user.name,
    photo: interest.user.photo,
    levels: parseLevels(interest.user.levels),
    area: interest.user.area,
    affiliateGym: interest.user.affiliateGym,
    isSingle: interest.user.isSingle,
    showSingleBadge: interest.user.showSingleBadge,
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <BackLink href={`/events/${event.id}`} className="mt-6">Back to {event.name}</BackLink>

      <div className="mt-4">
        <SectionCard title="Find a teammate">
          <p className="mb-3 text-sm text-b2b-ink/50">Browse who's interested, or post your own request below.</p>

          <InterestedAthletesCarousel athletes={athletes} />

          <div className="my-5 border-t border-b2b-purple/10" />

          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-b2b-ink/45">Post a request</p>
          <p className="mb-3 text-sm text-b2b-ink/50">Looking for teammates yourself? Let others know.</p>
          <EventNoticesPanel eventId={event.id} />
        </SectionCard>
      </div>
    </main>
  );
}
