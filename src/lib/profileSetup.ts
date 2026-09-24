import { parseLookingFor } from "@/lib/labels";
import type { AccountType, Level } from "@prisma/client";

/**
 * Whether a profile has everything setup requires: personal info (name,
 * already enforced at signup), area, gym, and — for an athlete only — a
 * level and at least one "looking for" tag. Used both to gate navigation
 * away from /profile/edit until setup is done, and to lock accountType once
 * it's true (see NavBar and /api/profile). Purely derived from existing
 * fields, so an account that already had all of this filled in before this
 * gate existed is treated as already complete — never retroactively locked
 * out of the app it was already using.
 */
export function isProfileSetupComplete(user: {
  accountType: AccountType;
  area: string | null;
  affiliateGym: string | null;
  level: Level | null;
  lookingFor: string | null;
}): boolean {
  if (!user.area || !user.affiliateGym) return false;
  if (user.accountType === "ATHLETE") {
    if (!user.level) return false;
    if (parseLookingFor(user.lookingFor).length === 0) return false;
  }
  return true;
}
