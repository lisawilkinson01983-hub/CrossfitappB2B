import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, scheduleBadgeSync } from "@/lib/prisma";
import { getNotificationSetting, parseNotificationPrefs } from "@/lib/notificationSettings";

/** Turns one row of Settings → Notifications on or off for one channel. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const setting = typeof body?.key === "string" ? getNotificationSetting(body.key) : undefined;
  const channel = body?.channel;
  if (!setting || (channel !== "push" && channel !== "inApp") || typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (channel === "inApp" && (setting.pushOnly || setting.inAppLocked)) {
    return NextResponse.json({ error: "This one can't be turned off in the app" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { notificationPrefs: true } });
  const prefs = parseNotificationPrefs(user?.notificationPrefs);
  const entry = { ...prefs[setting.key] };
  if (body.enabled) delete entry[channel as "push" | "inApp"];
  else entry[channel as "push" | "inApp"] = false;
  if (Object.keys(entry).length) prefs[setting.key] = entry;
  else delete prefs[setting.key];

  await prisma.user.update({
    where: { id: session.user.id },
    data: { notificationPrefs: Object.keys(prefs).length ? JSON.stringify(prefs) : null },
  });
  // Hiding (or un-hiding) a type changes the unread count on the app icon.
  if (channel === "inApp") scheduleBadgeSync(session.user.id);

  return NextResponse.json({ ok: true });
}
