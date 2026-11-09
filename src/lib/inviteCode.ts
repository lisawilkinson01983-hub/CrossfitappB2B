import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Excludes visually-ambiguous characters (0/O, 1/I/L) since this is meant to
// be typed or read aloud, not just clicked as a link.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function randomCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/** Generates a globally-unique invite code, retrying on the astronomically unlikely collision. */
export async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const existing = await prisma.user.findUnique({ where: { inviteCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique invite code");
}

/**
 * Every new signup gets a code already, and scripts/backfill-invite-codes.js
 * covers accounts from before that shipped, but this self-heals anywhere
 * else a user's code is needed (sharing a team invite, Settings) even if
 * neither has run yet.
 */
export async function getOrCreateInviteCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { inviteCode: true } });
  if (user?.inviteCode) return user.inviteCode;
  const inviteCode = await generateUniqueInviteCode();
  await prisma.user.update({ where: { id: userId }, data: { inviteCode } });
  return inviteCode;
}

/**
 * When INVITE_ONLY is "true", signing up needs an existing member's invite
 * code — how a closed test group stays closed without a site-wide password
 * (which home-screen apps on iPhone handle badly). Unset, a code is optional
 * and only credits a referral.
 */
export function isInviteOnly(): boolean {
  return process.env.INVITE_ONLY === "true";
}
