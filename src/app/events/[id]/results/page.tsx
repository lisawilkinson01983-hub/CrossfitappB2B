import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { Avatar } from "@/components/Avatar";
import { BackLink } from "@/components/BackLink";
import { TeamResultRow } from "@/components/TeamResultRow";
import { assertEventVisible } from "@/lib/eventVisibility";
import { isTeamFormatEvent, placeMedal, resultHeadline } from "@/lib/eventResults";

export default async function EventResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id: eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      isPrivate: true,
      status: true,
      createdById: true,
      submittedById: true,
      teamFormat: true,
    },
  });
  if (!event) notFound();
  if (!(await assertEventVisible(event, session.user.id))) notFound();

  const teamFormat = isTeamFormatEvent(event);

  const results = await prisma.eventResult.findMany({
    where: { eventId },
    select: {
      id: true,
      userId: true,
      teamId: true,
      placementType: true,
      place: true,
      totalCompetitors: true,
      division: true,
      user: { select: { id: true, name: true, photo: true } },
      team: {
        select: {
          id: true,
          name: true,
          members: { select: { user: { select: { id: true, name: true, photo: true } } } },
        },
      },
    },
  });

  // Exact placements first (ascending), then everyone marked just
  // "Completed" — SQLite's orderBy doesn't give reliable control over null
  // placement, so this sorts in JS instead.
  const ranked = [...results].sort((a, b) => {
    if (a.place != null && b.place != null) return a.place - b.place;
    if (a.place != null) return -1;
    if (b.place != null) return 1;
    return 0;
  });

  // One row per team, not per member — every member of a team shares the
  // same placement, so the first row encountered for a teamId is enough.
  const teamRows = teamFormat
    ? Array.from(new Map(ranked.filter((r) => r.team).map((r) => [r.teamId, r])).values())
    : [];

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <BackLink href={`/events/${event.id}`} className="mt-6">
        Back to {event.name}
      </BackLink>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl text-b2b-ink">🏆 Results</h1>
          <p className="mt-1 text-xs text-b2b-ink/50">
            {event.name} · {teamFormat ? teamRows.length : ranked.length} logged
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        {teamFormat ? (
          teamRows.length === 0 ? (
            <p className="py-6 text-center text-b2b-ink/40">No results logged yet.</p>
          ) : (
            teamRows.map((r, i) => (
              <TeamResultRow
                key={r.teamId}
                rank={i + 1}
                teamName={r.team!.name}
                members={r.team!.members.map((m) => m.user)}
                placementLabel={r.division ?? "—"}
                resultHeadline={resultHeadline(r)}
              />
            ))
          )
        ) : ranked.length === 0 ? (
          <p className="py-6 text-center text-b2b-ink/40">No results logged yet.</p>
        ) : (
          ranked.map((r, i) => {
            const rank = i + 1;
            const medal = placeMedal(r.place != null ? rank : null);
            return (
              <Link
                key={r.id}
                href={`/profile/${r.userId}`}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${
                  rank === 1 ? "border border-b2b-pink/35 bg-b2b-pink/10" : "bg-b2b-card"
                }`}
              >
                <span className={`w-6 text-center font-display text-xl ${rank === 1 ? "text-b2b-pink-dark" : "text-b2b-ink/40"}`}>
                  {rank}
                </span>
                <Avatar photo={r.user.photo} name={r.user.name} size={32} />
                <span className={`flex-1 truncate text-sm ${rank === 1 ? "font-extrabold" : "font-semibold"} text-b2b-ink`}>
                  {r.user.name}
                </span>
                {medal && <span className="text-sm">{medal}</span>}
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}
