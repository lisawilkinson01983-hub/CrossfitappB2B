import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type LeaderboardRow = {
  id: string;
  name: string;
  email: string;
  testGroup: string | null;
  posts: number;
  workouts: number;
  comments: number;
  likes: number;
  messages: number;
  eventActivity: number; // participating/interested in events + teammate notices posted
  referrals: number;
  loginDays: number;
  total: number;
};

/**
 * Builds the pilot-testing leaderboard: a per-user breakdown of activity
 * across the app, so the most engaged testers can be picked out for prizes.
 * Every signal is a straight count from data the app already records — no
 * separate event-logging needed for posts/workouts/etc (see LoginEvent for
 * the one signal — login days — that isn't otherwise tracked anywhere).
 */
export async function buildLeaderboard({
  since,
  testGroup,
}: {
  since?: Date;
  testGroup?: string;
}): Promise<LeaderboardRow[]> {
  const dateFilter = since ? { createdAt: { gte: since } } : {};

  const users = await prisma.user.findMany({
    where: { deletedAt: null, ...(testGroup ? { testGroup } : {}) },
    select: { id: true, name: true, email: true, testGroup: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return [];

  const [posts, workouts, comments, likes, messages, participants, interests, notices, referrals, loginDays] =
    await Promise.all([
      prisma.post.groupBy({ by: ["userId"], _count: true, where: { userId: { in: userIds }, ...dateFilter } }),
      prisma.workout.groupBy({ by: ["userId"], _count: true, where: { userId: { in: userIds }, ...dateFilter } }),
      prisma.comment.groupBy({ by: ["userId"], _count: true, where: { userId: { in: userIds }, ...dateFilter } }),
      prisma.like.groupBy({ by: ["userId"], _count: true, where: { userId: { in: userIds }, ...dateFilter } }),
      prisma.message.groupBy({ by: ["senderId"], _count: true, where: { senderId: { in: userIds }, ...dateFilter } }),
      prisma.eventParticipant.groupBy({ by: ["userId"], _count: true, where: { userId: { in: userIds }, ...dateFilter } }),
      prisma.eventInterest.groupBy({ by: ["userId"], _count: true, where: { userId: { in: userIds }, ...dateFilter } }),
      prisma.eventNotice.groupBy({ by: ["userId"], _count: true, where: { userId: { in: userIds }, ...dateFilter } }),
      prisma.user.groupBy({
        by: ["invitedById"],
        _count: true,
        where: { invitedById: { in: userIds }, ...dateFilter },
      }),
      // Prisma stores SQLite DateTime columns as Unix-millisecond integers,
      // not ISO text — date() can't parse those directly without first
      // converting through unixepoch, or it silently returns NULL (and
      // COUNT(DISTINCT NULL) an unnoticed 0) for every row.
      prisma.$queryRaw<{ userId: string; days: number }[]>`
        SELECT userId, COUNT(DISTINCT date(createdAt / 1000, 'unixepoch')) as days
        FROM LoginEvent
        WHERE userId IN (${Prisma.join(userIds)}) AND createdAt >= ${since ?? new Date(0)}
        GROUP BY userId
      `,
    ]);

  const postsByUser = new Map(posts.map((r) => [r.userId, r._count]));
  const workoutsByUser = new Map(workouts.map((r) => [r.userId, r._count]));
  const commentsByUser = new Map(comments.map((r) => [r.userId, r._count]));
  const likesByUser = new Map(likes.map((r) => [r.userId, r._count]));
  const messagesByUser = new Map(messages.map((r) => [r.senderId, r._count]));
  const participantsByUser = new Map(participants.map((r) => [r.userId, r._count]));
  const interestsByUser = new Map(interests.map((r) => [r.userId, r._count]));
  const noticesByUser = new Map(notices.map((r) => [r.userId, r._count]));
  const referralsByUser = new Map(
    referrals.filter((r) => r.invitedById !== null).map((r) => [r.invitedById as string, r._count])
  );
  const loginDaysByUser = new Map(loginDays.map((r) => [r.userId, Number(r.days)]));

  const rows: LeaderboardRow[] = users.map((u) => {
    const posts = postsByUser.get(u.id) ?? 0;
    const workouts = workoutsByUser.get(u.id) ?? 0;
    const comments = commentsByUser.get(u.id) ?? 0;
    const likes = likesByUser.get(u.id) ?? 0;
    const messages = messagesByUser.get(u.id) ?? 0;
    const eventActivity =
      (participantsByUser.get(u.id) ?? 0) + (interestsByUser.get(u.id) ?? 0) + (noticesByUser.get(u.id) ?? 0);
    const referrals = referralsByUser.get(u.id) ?? 0;
    const loginDays = loginDaysByUser.get(u.id) ?? 0;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      testGroup: u.testGroup,
      posts,
      workouts,
      comments,
      likes,
      messages,
      eventActivity,
      referrals,
      loginDays,
      total: posts + workouts + comments + likes + messages + eventActivity + referrals + loginDays,
    };
  });

  return rows.sort((a, b) => b.total - a.total);
}
