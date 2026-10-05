import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Deletes an account by anonymizing it and every profile under it, rather
 * than removing rows outright — messages already sent, and comments/notices
 * left on other people's content, still need somewhere valid to point (see
 * comments below). One login can hold more than one profile (see
 * src/lib/auth.ts), and deleting the account disables all of them, so every
 * profile gets anonymized together rather than just the one in use.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json({ error: "Enter your password to confirm" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { account: true } });
  if (!user?.account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const valid = await bcrypt.compare(password, user.account.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 400 });
  }

  const accountId = user.account.id;
  const profiles = await prisma.user.findMany({ where: { accountId }, select: { id: true } });
  const userIds = profiles.map((p) => p.id);
  const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

  await prisma.$transaction([
    // Redact rather than delete — keeps thread structure intact for replies
    // and likes left by other people, and avoids Comment's/EventNoticeComment's
    // self-referencing cascade wiping out someone else's reply to this user.
    prisma.comment.updateMany({ where: { userId: { in: userIds } }, data: { text: "[deleted]" } }),
    prisma.eventNoticeComment.updateMany({ where: { userId: { in: userIds } }, data: { text: "[deleted]" } }),
    prisma.eventNotice.updateMany({
      where: { userId: { in: userIds }, text: { not: null } },
      data: { text: "[deleted]" },
    }),

    // Purely personal content and join records — safe to remove outright.
    prisma.commentLike.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.eventNoticeLike.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.like.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.workout.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.post.deleteMany({ where: { userId: { in: userIds } } }), // cascades these profiles' own comments/likes/notifications
    prisma.eventParticipant.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.eventInterest.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.eventPin.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.eventTeammateAlert.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.follow.deleteMany({ where: { OR: [{ followerId: { in: userIds } }, { followingId: { in: userIds } }] } }),
    prisma.followRequest.deleteMany({
      where: { OR: [{ requesterId: { in: userIds } }, { targetId: { in: userIds } }] },
    }),
    prisma.block.deleteMany({ where: { OR: [{ blockerId: { in: userIds } }, { blockedId: { in: userIds } }] } }),
    prisma.mute.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { mutedUserId: { in: userIds } }] } }),
    prisma.notification.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { actorId: { in: userIds } }] } }),

    // Release any gym directory entry a profile here had claimed (see
    // Gym.claimedById) — onDelete: SetNull only fires on an actual row
    // delete, and these rows are anonymized in place, not deleted.
    prisma.gym.updateMany({ where: { claimedById: { in: userIds } }, data: { claimedById: null } }),

    // Anonymize the login itself, so it can never sign in again.
    prisma.account.update({
      where: { id: accountId },
      data: {
        email: `deleted-${accountId}@deleted.box2box.invalid`,
        passwordHash: unusablePasswordHash,
        emailVerifiedAt: null,
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
        deletedAt: new Date(),
      },
    }),

    // Anonymize every profile under it. Messages, reports, and events/gyms
    // these profiles created or submitted are deliberately left alone (see
    // the route's doc comment and the Privacy Policy).
    prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: {
        name: "Deleted User",
        photo: null,
        bio: null,
        dateOfBirth: null,
        gender: null,
        area: null,
        areaLat: null,
        areaLng: null,
        affiliateGym: null,
        affiliateGymOther: null,
        level: null,
        crossfitSinceYear: null,
        crossfitSinceMonth: null,
        lookingFor: null,
        showAge: false,
        isSingle: null,
        showRelationshipStatus: false,
        showSingleBadge: false,
        showLookingFor: false,
        isPrivate: true,
        deadliftKg: null,
        sumoDeadliftKg: null,
        deficitDeadliftKg: null,
        cleanPullKg: null,
        snatchPullKg: null,
        cleanKg: null,
        powerCleanKg: null,
        hangCleanKg: null,
        hangPowerCleanKg: null,
        cleanAndJerkKg: null,
        snatchKg: null,
        powerSnatchKg: null,
        hangSnatchKg: null,
        hangPowerSnatchKg: null,
        splitJerkKg: null,
        pushJerkKg: null,
        strictPressKg: null,
        shoulderPressKg: null,
        pushPressKg: null,
        benchPressKg: null,
        frontSquatKg: null,
        backSquatKg: null,
        ohsKg: null,
        displayedPbs: null,
        connectedPlatform: null,
        platformUserId: null,
        deletedAt: new Date(),
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
