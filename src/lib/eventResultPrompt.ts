import { prisma } from "@/lib/prisma";

export type ResultPromptPayload =
  | {
      kind: "solo";
      eventId: string;
      eventName: string;
      eventPhoto: string | null;
      eventDate: Date;
      eventEndDate: Date | null;
      isOnline: boolean;
      location: string | null;
      division: string | null;
    }
  | {
      kind: "team";
      eventId: string;
      eventName: string;
      eventPhoto: string | null;
      teamId: string;
      teamName: string;
      members: { id: string; name: string; photo: string | null }[];
      division: string | null;
    };

/**
 * The event (if any) this user should be asked "did you compete at X?" for
 * on next login — the most-recently-ended event they're an EventParticipant
 * on with no EventResult logged yet and no prior dismissal. Only ever one
 * at a time, so logging/dismissing it is what surfaces the next-oldest.
 * Caller is responsible for the beta-rollout check (src/lib/resultsRollout.ts)
 * before calling this — kept separate so this stays reusable once the gate
 * widens.
 */
function pendingPromptWhere(userId: string, now: Date) {
  return {
    userId,
    event: {
      AND: [
        { OR: [{ endDate: null, date: { lt: now } }, { endDate: { lt: now } }] },
        { results: { none: { userId } } },
        { resultPromptDismissals: { none: { userId } } },
      ],
    },
  };
}

/** How many past events are still waiting on a result, including the one `findResultPrompt` would return next — lets the prompt UI show "1 of 3" rather than surfacing events one at a time with no sense of how many are queued. */
export async function countResultPrompts(userId: string): Promise<number> {
  return prisma.eventParticipant.count({ where: pendingPromptWhere(userId, new Date()) });
}

export async function findResultPrompt(userId: string): Promise<ResultPromptPayload | null> {
  const now = new Date();
  const participant = await prisma.eventParticipant.findFirst({
    where: pendingPromptWhere(userId, now),
    orderBy: { event: { date: "desc" } },
    select: {
      event: {
        select: {
          id: true,
          name: true,
          photo: true,
          date: true,
          endDate: true,
          isOnline: true,
          location: true,
          division: true,
        },
      },
    },
  });
  if (!participant) return null;
  const event = participant.event;

  const teamMembership = await prisma.teamMember.findFirst({
    where: { userId, team: { eventId: event.id } },
    select: {
      team: {
        select: {
          id: true,
          name: true,
          members: { select: { user: { select: { id: true, name: true, photo: true } } } },
        },
      },
    },
  });
  if (teamMembership) {
    return {
      kind: "team",
      eventId: event.id,
      eventName: event.name,
      eventPhoto: event.photo,
      teamId: teamMembership.team.id,
      teamName: teamMembership.team.name,
      members: teamMembership.team.members.map((m) => m.user),
      division: event.division,
    };
  }

  return {
    kind: "solo",
    eventId: event.id,
    eventName: event.name,
    eventPhoto: event.photo,
    eventDate: event.date,
    eventEndDate: event.endDate,
    isOnline: event.isOnline,
    location: event.location,
    division: event.division,
  };
}

/** "No, I/we didn't make it" or "Skip for now" — a team dismissal covers every member, not just whoever answered. */
export async function dismissResultPrompt(userId: string, eventId: string): Promise<void> {
  const teamMembership = await prisma.teamMember.findFirst({
    where: { userId, team: { eventId } },
    select: { team: { select: { members: { select: { userId: true } } } } },
  });
  const userIds = teamMembership ? teamMembership.team.members.map((m) => m.userId) : [userId];
  // SQLite's createMany has no skipDuplicates — upsert each row instead
  // (team rosters are small, so this stays cheap).
  await Promise.all(
    userIds.map((uid) =>
      prisma.eventResultPromptDismissal.upsert({
        where: { userId_eventId: { userId: uid, eventId } },
        create: { userId: uid, eventId },
        update: {},
      })
    )
  );
}
