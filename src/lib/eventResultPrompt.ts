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

type PromptEvent = {
  id: string;
  name: string;
  photo: string | null;
  date: Date;
  endDate: Date | null;
  isOnline: boolean;
  location: string | null;
  division: string | null;
};

const PROMPT_EVENT_SELECT = {
  id: true,
  name: true,
  photo: true,
  date: true,
  endDate: true,
  isOnline: true,
  location: true,
  division: true,
} as const;

/** Builds the solo/team payload for one event+user pair — shared by the
 * automatic catch-up queue and a manual "Log result" trigger, since both
 * ultimately need the same "is this person on a registered team for this
 * event?" check to decide which flow to show. */
async function buildPromptPayload(userId: string, event: PromptEvent): Promise<ResultPromptPayload> {
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

export async function findResultPrompt(userId: string): Promise<ResultPromptPayload | null> {
  const participant = await prisma.eventParticipant.findFirst({
    where: pendingPromptWhere(userId, new Date()),
    orderBy: { event: { date: "desc" } },
    select: { event: { select: PROMPT_EVENT_SELECT } },
  });
  if (!participant) return null;
  return buildPromptPayload(userId, participant.event);
}

/**
 * The same payload, but for one specific event rather than whatever's next
 * in the catch-up queue — backs the manual "Log result" button on the
 * event's own results page, for someone who dismissed/skipped the automatic
 * prompt (or was never queued for it at all, e.g. the event hasn't crossed
 * into beta yet) and wants to log it anyway. Only refuses when a result
 * already exists for them — unlike the queue, this intentionally ignores
 * the dismissal and beta-rollout gates, since asking is proactive but
 * logging on request is not.
 */
export async function findResultPromptForEvent(userId: string, eventId: string): Promise<ResultPromptPayload | null> {
  const [event, existingResult] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: PROMPT_EVENT_SELECT }),
    prisma.eventResult.findUnique({ where: { eventId_userId: { eventId, userId } }, select: { id: true } }),
  ]);
  const hasEnded = event ? (event.endDate ? event.endDate < new Date() : event.date < new Date()) : false;
  if (!event || existingResult || !hasEnded) return null;
  return buildPromptPayload(userId, event);
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
