import { parseLevels } from "@/lib/labels";
import type { AccountType } from "@prisma/client";

/**
 * Whether a profile has everything setup requires: personal info (name,
 * already enforced at signup), area, gym, and — for an athlete only — a
 * level. Used both to gate navigation away from /profile/edit until setup
 * is done, and to lock accountType once it's true (see NavBar and
 * /api/profile). Purely derived from existing fields, so an account that
 * already had all of this filled in before this gate existed is treated as
 * already complete — never retroactively locked out of the app it was
 * already using.
 *
 * "Looking for" used to be required here too, back when ProfileSetupWizard
 * asked it at signup — it no longer does (Settings → Edit profile →
 * Interested in is still there for anyone who wants to set it), so an
 * empty one is no longer a reason to call setup incomplete.
 */
export function isProfileSetupComplete(user: {
  accountType: AccountType;
  area: string | null;
  affiliateGym: string | null;
  levels: string | null;
}): boolean {
  if (!user.area || !user.affiliateGym) return false;
  if (user.accountType === "ATHLETE") {
    if (parseLevels(user.levels).length === 0) return false;
  }
  return true;
}
