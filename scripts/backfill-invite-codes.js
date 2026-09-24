// Runs on every deploy (see package.json's start:railway): gives every
// account without one a unique invite code (new signups already get one —
// see src/lib/inviteCode.ts — so this only ever touches accounts created
// before that shipped). Idempotent and cheap to run on every boot.
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function randomCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({ where: { inviteCode: null }, select: { id: true } });
    let count = 0;
    for (const user of users) {
      // Retry on the astronomically unlikely collision.
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomCode();
        try {
          await prisma.user.update({ where: { id: user.id }, data: { inviteCode: code } });
          count++;
          break;
        } catch (err) {
          if (err.code !== "P2002") throw err; // unique constraint — try another code
        }
      }
    }
    if (count > 0) {
      console.log(`backfill-invite-codes: assigned codes to ${count} account(s)`);
    } else {
      console.log("backfill-invite-codes: nothing to do");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-invite-codes failed:", err);
  // Never block the deploy over this.
  process.exit(0);
});
