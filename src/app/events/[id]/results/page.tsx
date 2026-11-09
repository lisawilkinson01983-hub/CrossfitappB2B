import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { Avatar } from "@/components/Avatar";
import { BackLink } from "@/components/BackLink";
import { TeamResultRow } from "@/components/TeamResultRow";
import { DeleteMyResultButton } from "@/components/DeleteMyResultButton";
import { assertEventVisible } from "@/lib/eventVisibility";
import { placeMedal, resultHeadline } from "@/lib/eventResults";

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
    },
  });
  if (!event) notFound();
  if (!(await assertEventVisible(event, session.user.id))) notFound();

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

  // Whether a result is a team's or an individual's is read straight off its
  // own teamId, never the event's own teamFormat field — that's often unset
  // on a curated/legacy event even when the result really was logged through
  // the team flow, and gating on it showed every member of a team as their
  // own separately-ranked row instead of one row for the team. Rows sharing
  // a teamId collapse into a single team row (first one encountered carries
  // the shared placement, since every member's row has the same data).
  type DisplayRow =
    | {
        kind: "team";
        place: number | null;
        placementType: "EXACT" | "COMPLETED";
        teamId: string;
        teamName: string;
        members: { id: string; name: string; photo: string | null }[];
        division: string | null;
      }
    | {
        kind: "solo";
        place: number | null;
        placementType: "EXACT" | "COMPLETED";
        resultId: string;
        userId: string;
        name: string;
        photo: string | null;
      };

  const seenTeamIds = new Set<string>();
  const displayRows: DisplayRow[] = [];
  for (const r of results) {
    if (r.team && r.teamId) {
      if (seenTeamIds.has(r.teamId)) continue;
      seenTeamIds.add(r.teamId);
      displayRows.push({
        kind: "team",
        place: r.place,
        placementType: r.placementType,
        teamId: r.teamId,
        teamName: r.team.name,
        members: r.team.members.map((m) => m.user),
        division: r.division,
      });
    } else {
      displayRows.push({
        kind: "solo",
        place: r.place,
        placementType: r.placementType,
        resultId: r.id,
        userId: r.userId,
        name: r.user.name,
        photo: r.user.photo,
      });
    }
  }

  // Exact placements first (ascending), then everyone marked just
  // "Completed" — SQLite's orderBy doesn't give reliable control over null
  // placement, so this sorts in JS instead.
  const ranked = displayRows.sort((a, b) => {
    if (a.place != null && b.place != null) return a.place - b.place;
    if (a.place != null) return -1;
    if (b.place != null) return 1;
    return 0;
  });

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
            {event.name} · {ranked.length} logged
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        {ranked.length === 0 ? (
          <p className="py-6 text-center text-b2b-ink/40">No results logged yet.</p>
        ) : (
          ranked.map((r, i) => {
            const rank = i + 1;
            if (r.kind === "team") {
              return (
                <TeamResultRow
                  key={r.teamId}
                  rank={rank}
                  teamName={r.teamName}
                  members={r.members}
                  placementLabel={r.division ?? "—"}
                  resultHeadline={resultHeadline(r)}
                />
              );
            }
            const medal = placeMedal(r.place != null ? rank : null);
            return (
              <div
                key={r.resultId}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${
                  rank === 1 ? "border border-b2b-pink/35 bg-b2b-pink/10" : "bg-b2b-card"
                }`}
              >
                <Link href={`/profile/${r.userId}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span className={`w-6 text-center font-display text-xl ${rank === 1 ? "text-b2b-pink-dark" : "text-b2b-ink/40"}`}>
                    {rank}
                  </span>
                  <Avatar photo={r.photo} name={r.name} size={32} />
                  <span className={`flex-1 truncate text-sm ${rank === 1 ? "font-extrabold" : "font-semibold"} text-b2b-ink`}>
                    {r.name}
                  </span>
                </Link>
                {medal && <span className="text-sm">{medal}</span>}
                {r.userId === session.user.id && <DeleteMyResultButton resultId={r.resultId} />}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
