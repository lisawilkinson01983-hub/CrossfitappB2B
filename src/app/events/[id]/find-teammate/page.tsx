import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { EventNoticesPanel } from "@/components/EventNoticesPanel";
import { InterestedAthletesCarousel, type InterestedAthlete } from "@/components/InterestedAthletesCarousel";
import { SuggestedTeammates, type SuggestedTeammate } from "@/components/SuggestedTeammates";
import { SuggestedTeams } from "@/components/SuggestedTeams";
import { parseLevels, parseJsonArray, LEVEL_LABELS } from "@/lib/labels";
import { assertEventVisible } from "@/lib/eventVisibility";
import { BackLink } from "@/components/BackLink";
import { PB_FIELDS, type EventGenderCategoryOption, type EventTeamFormatOption, type PbField } from "@/lib/validation";
import { ensureUserAreaCoords } from "@/lib/geocode";
import { scoreTeammateMatch, type MatchProfile, type MatchWorkout } from "@/lib/teammateMatchScore";
import { suggestTeams, type TeammatePoolMember } from "@/lib/teamSuggestions";

export default async function FindTeammatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const workoutSelect = { wodName: true, unit: true, score: true, rounds: true, reps: true } as const;
  const pbSelect = Object.fromEntries(PB_FIELDS.map((f) => [f, true])) as Record<PbField, true>;

  const [event, me, teamedUserRows] = await Promise.all([
    prisma.event.findUnique({
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
                openLevel: true,
                area: true,
                affiliateGym: true,
                isSingle: true,
                showSingleBadge: true,
                gender: true,
                areaLat: true,
                areaLng: true,
                workouts: { select: workoutSelect },
                ...pbSelect,
              },
            },
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        levels: true,
        openLevel: true,
        gender: true,
        area: true,
        areaLat: true,
        areaLng: true,
        workouts: { select: workoutSelect },
        ...pbSelect,
      },
    }),
    prisma.teamMember.findMany({ where: { team: { eventId: id } }, select: { userId: true } }),
  ]);
  if (!event) notFound();
  if (!(await assertEventVisible(event, session.user.id))) notFound();
  if (!me) redirect("/login");

  const [myInterest, myTeamMembership] = await Promise.all([
    prisma.eventInterest.findUnique({ where: { userId_eventId: { userId: session.user.id, eventId: id } } }),
    prisma.teamMember.findFirst({ where: { userId: session.user.id, team: { eventId: id } } }),
  ]);

  const athletes: InterestedAthlete[] = event.interests.map((interest) => ({
    id: interest.user.id,
    name: interest.user.name,
    photo: interest.user.photo,
    levels: parseLevels(interest.user.levels),
    openLevel: interest.user.openLevel,
    area: interest.user.area,
    affiliateGym: interest.user.affiliateGym,
    isSingle: interest.user.isSingle,
    showSingleBadge: interest.user.showSingleBadge,
  }));

  // --- Suggested for you: a match score per interested athlete, ranked.
  const myCoords = await ensureUserAreaCoords(me, { background: true });
  const myProfile: MatchProfile & { coords: typeof myCoords; workouts: MatchWorkout[] } = {
    id: me.id,
    levels: parseLevels(me.levels),
    openLevel: me.openLevel,
    pbs: Object.fromEntries(PB_FIELDS.map((f) => [f, me[f]])) as Partial<Record<PbField, number | null>>,
    coords: myCoords,
    workouts: me.workouts,
  };

  const suggestedTeammates: SuggestedTeammate[] = event.interests
    .map((interest) => {
      const u = interest.user;
      const candidateProfile: MatchProfile & { coords: Awaited<ReturnType<typeof ensureUserAreaCoords>>; workouts: MatchWorkout[] } = {
        id: u.id,
        levels: parseLevels(u.levels),
        openLevel: u.openLevel,
        pbs: Object.fromEntries(PB_FIELDS.map((f) => [f, u[f]])) as Partial<Record<PbField, number | null>>,
        coords: u.areaLat != null && u.areaLng != null ? { lat: u.areaLat, lng: u.areaLng } : null,
        workouts: u.workouts,
      };
      const { score, reasons } = scoreTeammateMatch(myProfile, candidateProfile);
      const levelLabels = candidateProfile.levels.map((l) => LEVEL_LABELS[l]);
      const subtitle =
        [levelLabels.join("/"), u.openLevel != null ? `Level ${u.openLevel}` : null].filter(Boolean).join(" · ") || null;
      return { id: u.id, name: u.name, photo: u.photo, score, subtitle, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  // --- Suggested full teams: only for a Male- or Female-pairs/teams event,
  // once I'm interested myself and don't already have a team here.
  const teamFormat = parseJsonArray<EventTeamFormatOption>(event.teamFormat);
  const genderCategory = parseJsonArray<EventGenderCategoryOption>(event.genderCategory);
  const singleGenderFormat: EventGenderCategoryOption | null =
    genderCategory.length === 1 && (genderCategory[0] === "MALE" || genderCategory[0] === "FEMALE")
      ? genderCategory[0]
      : null;
  const applicableTeamFormat = teamFormat.find((f) => f === "PAIRS" || f === "TEAMS") ?? null;

  const teamedUserIds = new Set(teamedUserRows.map((r) => r.userId));

  let suggestedTeams: ReturnType<typeof suggestTeams> = [];
  if (
    applicableTeamFormat &&
    singleGenderFormat &&
    myInterest &&
    !myTeamMembership &&
    me.gender === singleGenderFormat
  ) {
    const pool: TeammatePoolMember[] = event.interests
      .filter((interest) => interest.user.gender === singleGenderFormat && !teamedUserIds.has(interest.user.id))
      .map((interest) => ({
        id: interest.user.id,
        name: interest.user.name,
        photo: interest.user.photo,
        openLevel: interest.user.openLevel,
        coords:
          interest.user.areaLat != null && interest.user.areaLng != null
            ? { lat: interest.user.areaLat, lng: interest.user.areaLng }
            : null,
      }));

    suggestedTeams = suggestTeams(
      { id: me.id, name: "You", photo: null, openLevel: me.openLevel, coords: myCoords },
      pool,
      applicableTeamFormat
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <BackLink href={`/events/${event.id}`} className="mt-6">Back to {event.name}</BackLink>

      <div className="mt-4 flex flex-col gap-4">
        {suggestedTeammates.length > 0 && (
          <SectionCard>
            <SuggestedTeammates items={suggestedTeammates} />
          </SectionCard>
        )}

        {suggestedTeams.length > 0 && (
          <SectionCard>
            <SuggestedTeams teams={suggestedTeams} eventName={event.name} />
          </SectionCard>
        )}

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
