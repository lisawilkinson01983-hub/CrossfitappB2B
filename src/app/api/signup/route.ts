import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validation";
import { generateToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { generateUniqueInviteCode, isInviteOnly } from "@/lib/inviteCode";
import { getSiteAccountId } from "@/lib/siteAccount";

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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const now = new Date();
  const emailVerificationToken = generateToken();
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

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      termsAcceptedAt: now,
      ageConfirmedAt: now,
      emailVerificationToken,
      emailVerificationTokenExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      inviteCode,
      invitedById: referrer?.id,
    },
  });

  await addWelcomeFriend(user.id);
  await sendVerificationEmail(email, emailVerificationToken);

  return NextResponse.json({ ok: true });
}

async function sendVerificationEmail(email: string, token: string) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Verify your Box 2 Box email",
    text: `Welcome to Box 2 Box! Confirm your email address by visiting this link:\n\n${verifyUrl}\n\nThis link expires in 24 hours.`,
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
