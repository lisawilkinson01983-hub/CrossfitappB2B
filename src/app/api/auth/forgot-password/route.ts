import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validation";
import { generateToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const rateLimit = checkRateLimit(getClientIp(req.headers), "forgot-password", {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // Always respond the same way whether or not the email has an account, so
  // this endpoint can't be used to check who's registered.
  if (user) {
    const token = generateToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    await sendEmail({
      to: user.email,
      subject: "Reset your Box 2 Box password",
      text: `Someone requested a password reset for this account. If that was you, visit this link to set a new password:\n\n${baseUrl}/reset-password?token=${token}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
    });
  }

  return NextResponse.json({ ok: true });
}
