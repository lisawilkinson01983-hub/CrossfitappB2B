import { prisma } from "@/lib/prisma";
import { apnsConfigured, sendApns, sendApnsBadge } from "./apns";
import { unreadBadgeCount } from "@/lib/unread";
import { fcmConfigured, sendFcm } from "./fcm";
import type { PushMessage, SendResult } from "./types";

export type { PushMessage } from "./types";

/** True when at least one of Apple/Google push is set up — otherwise there's nothing to do. */
export function pushConfigured(): boolean {
  return apnsConfigured() || fcmConfigured();
}

/**
 * Sends one push to every registered phone of a profile. Never throws: a
 * failure is logged and the rest still go out. Devices Apple/Google report
 * as permanently invalid are deleted.
 */
export async function sendPushToUser(userId: string, message: PushMessage): Promise<void> {
  if (!pushConfigured()) return;
  const devices = await prisma.pushDevice.findMany({ where: { userId }, select: { token: true, platform: true } });
  if (devices.length === 0) return;

  const ios = devices.filter((d) => d.platform === "IOS").map((d) => d.token);
  const android = devices.filter((d) => d.platform === "ANDROID").map((d) => d.token);
  // Counted after the new notification/message was saved, so it's included.
  message = { ...message, badge: await unreadBadgeCount(userId) };

  const results: SendResult[] = (
    await Promise.all([
      apnsConfigured() ? sendApns(ios, message).catch((e) => failAll(ios, e)) : [],
      fcmConfigured() ? sendFcm(android, message).catch((e) => failAll(android, e)) : [],
    ])
  ).flat();
  await handleResults(results);
}

/**
 * Brings the number on a profile's app icon up to date (iPhone only —
 * Android clears its dot when the notifications are opened or dismissed).
 * Called after notifications or messages are marked read.
 */
export async function syncBadge(userId: string): Promise<void> {
  if (!apnsConfigured()) return;
  const ios = (await prisma.pushDevice.findMany({ where: { userId, platform: "IOS" }, select: { token: true } })).map(
    (d) => d.token
  );
  if (ios.length === 0) return;
  const badge = await unreadBadgeCount(userId);
  await handleResults(await sendApnsBadge(ios, badge).catch((e) => failAll(ios, e)));
}

async function handleResults(results: SendResult[]): Promise<void> {
  const dead = results.filter((r) => r.tokenInvalid).map((r) => r.token);
  if (dead.length) await prisma.pushDevice.deleteMany({ where: { token: { in: dead } } });
  for (const r of results) {
    if (!r.ok && !r.tokenInvalid) console.error(`[push] ${r.error}`);
  }
}

function failAll(tokens: string[], err: unknown): SendResult[] {
  return tokens.map((token) => ({ token, ok: false, error: (err as Error).message }));
}
