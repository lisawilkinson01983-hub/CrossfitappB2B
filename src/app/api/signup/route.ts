import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { generateUniqueInviteCode, isInviteOnly } from "@/lib/inviteCode";
import { getSiteAccountId } from "@/lib/siteAccount";
import { addUserToTeam } from "@/lib/teams";

export async function POST(req: Request) {
  const rateLimit = checkRateLimit(getClientIp(req.headers), "signup", { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();

  const existing = await prisma.account.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const now = new Date();
  const inviteCode = await generateUniqueInviteCode();

  // Outside invite-only mode, an invalid/unrecognized code just means an
  // organic signup — it's not worth failing signup over a typo'd or stale
  // referral link.
  const referrer = parsed.data.inviteCode
    ? await prisma.user.findUnique({
        where: { inviteCode: parsed.data.inviteCode.toUpperCase() },
        select: { id: true },
      })
    : null;

  if (isInviteOnly() && !referrer) {
    return NextResponse.json(
      {
        error: parsed.data.inviteCode
          ? "That invite code isn't valid. Check it with the person who invited you."
          : "Box 2 Box is invite-only right now. Enter the invite code you were sent.",
      },
      { status: 403 }
    );
  }

  const account = await prisma.account.create({
    data: { email, passwordHash },
  });

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      accountId: account.id,
      termsAcceptedAt: now,
      ageConfirmedAt: now,
      inviteCode,
      invitedById: referrer?.id,
    },
  });

  await addWelcomeFriend(user.id);
  await notifyAdminsOfSignup(user.id);
  if (parsed.data.teamInviteToken) {
    await claimTeamInviteLink(parsed.data.teamInviteToken, user.id);
  }

  return NextResponse.json({ ok: true });
}

/**
 * Turns a freeform ("not on the app yet") roster slot into a real
 * membership the moment that exact person signs up through their own
 * team invite link (see TeamInviteLink, TeamRosterTrigger) — an invalid,
 * already-claimed, or otherwise stale token just means a normal signup
 * with no team attached, same as a bad general inviteCode never blocks
 * signup either.
 */
async function claimTeamInviteLink(token: string, newUserId: string) {
  const link = await prisma.teamInviteLink.findUnique({ where: { id: token } });
  if (!link || link.claimedAt) return;

  const team = await prisma.team.findUnique({ where: { id: link.teamId } });
  if (!team) return;

  const freeformNames: string[] = team.freeformMemberNames ? JSON.parse(team.freeformMemberNames) : [];
  const remaining = freeformNames.filter((n) => n.toLowerCase() !== link.freeformName.toLowerCase());

  await prisma.team.update({
    where: { id: team.id },
    data: { freeformMemberNames: remaining.length > 0 ? JSON.stringify(remaining) : null },
  });
  await prisma.teamInviteLink.update({
    where: { id: token },
    data: { claimedByUserId: newUserId, claimedAt: new Date() },
  });
  await addUserToTeam(team.id, newUserId);
}

/** Lets every admin know a brand new account just joined — same "sent to every admin" pattern as event/gym submissions. */
async function notifyAdminsOfSignup(newUserId: string) {
  const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  if (admins.length === 0) return;

  await prisma.notification.createMany({
    data: admins
      .filter((admin) => admin.id !== newUserId)
      .map((admin) => ({
        userId: admin.id,
        actorId: newUserId,
        type: "NEW_USER_SIGNUP" as const,
      })),
  });
}

/**
 * The site's own account (see src/lib/siteAccount.ts) is auto-connected as a
 * mutual friend for every new signup, MySpace-Tom style. Best-effort: any
 * failure here (unset env var, account not found) never blocks signup itself.
 */
async function addWelcomeFriend(newUserId: string) {
  const siteAccountId = await getSiteAccountId();
  if (!siteAccountId || siteAccountId === newUserId) return;

  const admin = await prisma.user.findUnique({ where: { id: siteAccountId }, select: { isPrivate: true } });
  if (!admin) return;

  // The new user was just created with isPrivate's default (false), so this
  // direction is always a direct follow.
  await prisma.follow.create({ data: { followerId: siteAccountId, followingId: newUserId } });

  // If the admin account is private, leave a paper trail matching the normal
  // accept flow (an ACCEPTED FollowRequest) rather than silently bypassing it.
  if (admin.isPrivate) {
    await prisma.followRequest.create({
      data: { requesterId: newUserId, targetId: siteAccountId, status: "ACCEPTED" },
    });
  }
  await prisma.follow.create({ data: { followerId: newUserId, followingId: siteAccountId } });
}
