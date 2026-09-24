import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(session.user.id, "resend-verification", {
    limit: 3,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Please wait a while before requesting another email." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.emailVerifiedAt) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const token = generateToken();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: token,
      emailVerificationTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const sent = await sendEmail({
    to: user.email,
    subject: "Verify your Box 2 Box email",
    text: `Confirm your email address by visiting this link:\n\n${baseUrl}/verify-email?token=${token}\n\nThis link expires in 24 hours.`,
  });
  if (!sent) {
    return NextResponse.json({ error: "Couldn't send the email right now. Please try again later." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
