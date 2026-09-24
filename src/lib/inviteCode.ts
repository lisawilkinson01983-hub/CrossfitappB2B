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
