import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Deletes an account by anonymizing the User row rather than removing it
 * outright — messages already sent, and comments/notices left on other
 * people's content, still need somewhere valid to point (see comments
 * below). The row survives as "Deleted User"; everything genuinely
 * personal (profile fields, own posts/workouts, connections) is removed.
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

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 400 });
  }

  const userId = user.id;
  const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

  await prisma.$transaction([
    // Redact rather than delete — keeps thread structure intact for replies
    // and likes left by other people, and avoids Comment's/EventNoticeComment's
    // self-referencing cascade wiping out someone else's reply to this user.
    prisma.comment.updateMany({ where: { userId }, data: { text: "[deleted]" } }),
    prisma.eventNoticeComment.updateMany({ where: { userId }, data: { text: "[deleted]" } }),
    prisma.eventNotice.updateMany({ where: { userId, text: { not: null } }, data: { text: "[deleted]" } }),

    // Purely personal content and join records — safe to remove outright.
    prisma.commentLike.deleteMany({ where: { userId } }),
    prisma.eventNoticeLike.deleteMany({ where: { userId } }),
    prisma.like.deleteMany({ where: { userId } }),
    prisma.workout.deleteMany({ where: { userId } }),
    prisma.post.deleteMany({ where: { userId } }), // cascades this user's own comments/likes/notifications
    prisma.eventParticipant.deleteMany({ where: { userId } }),
    prisma.eventInterest.deleteMany({ where: { userId } }),
    prisma.eventPin.deleteMany({ where: { userId } }),
    prisma.eventTeammateAlert.deleteMany({ where: { userId } }),
    prisma.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }),
    prisma.followRequest.deleteMany({ where: { OR: [{ requesterId: userId }, { targetId: userId }] } }),
    prisma.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } }),
    prisma.mute.deleteMany({ where: { OR: [{ userId }, { mutedUserId: userId }] } }),
    prisma.notification.deleteMany({ where: { OR: [{ userId }, { actorId: userId }] } }),

    // Anonymize the account itself. Messages, reports, and events/gyms this
    // user created or submitted are deliberately left alone (see the route's
    // doc comment and the Privacy Policy).
    prisma.user.update({
      where: { id: userId },
      data: {
        name: "Deleted User",
        email: `deleted-${userId}@deleted.box2box.invalid`,
        passwordHash: unusablePasswordHash,
        photo: null,
        bio: null,
        age: null,
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
        emailVerifiedAt: null,
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
        deletedAt: new Date(),
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
