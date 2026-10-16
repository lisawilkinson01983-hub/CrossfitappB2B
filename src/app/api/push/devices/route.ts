import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const deviceSchema = z.object({
  token: z.string().trim().min(8).max(4096),
  platform: z.enum(["ios", "android"]),
});

/**
 * Registers this phone for push notifications to the signed-in profile —
 * called by the store app on every launch (NativePush.tsx). A token is
 * unique per app install, so re-registering just moves it to whichever
 * profile is now active and refreshes lastSeenAt.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const parsed = deviceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid device" }, { status: 400 });
  }
  const { token } = parsed.data;
  const platform = parsed.data.platform === "ios" ? "IOS" : "ANDROID";
  const now = new Date();

  await prisma.pushDevice.upsert({
    where: { token },
    create: { token, platform, userId: session.user.id },
    update: { platform, userId: session.user.id, lastSeenAt: now },
  });
  return NextResponse.json({ ok: true });
}

/** Stops pushes to this phone — called on sign-out, before the session ends. */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : null;
  if (!token) return NextResponse.json({ error: "Invalid device" }, { status: 400 });

  // Only devices registered to this login's profiles — never someone else's.
  await prisma.pushDevice.deleteMany({
    where: { token, user: { accountId: session.user.accountId } },
  });
  return NextResponse.json({ ok: true });
}
