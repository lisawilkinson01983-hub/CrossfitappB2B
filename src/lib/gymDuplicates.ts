import { prisma } from "@/lib/prisma";

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/** Fraction of the smaller word set shared between the two names. */
function wordOverlapRatio(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(/\s+/).filter(Boolean));
  const wordsB = new Set(normalize(b).split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let shared = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) shared++;
  }
  return shared / Math.min(wordsA.size, wordsB.size);
}

/**
 * Flags — never blocks — gyms that look like they might be the same
 * listing: a name that's an exact match, a substring of the other, or
 * shares at least half its words. Considers both approved and already-
 * pending gyms, so two submitters can't unknowingly create duplicate
 * pending listings for the same affiliate.
 */
export async function findSimilarGyms(name: string) {
  const normalizedInput = normalize(name);
  if (!normalizedInput) return [];

  const candidates = await prisma.gym.findMany({
    where: { status: { in: ["APPROVED", "PENDING"] } },
    select: { id: true, name: true, address: true },
  });

  return candidates.filter((candidate) => {
    const normalizedCandidate = normalize(candidate.name);
    if (!normalizedCandidate) return false;
    if (normalizedCandidate === normalizedInput) return true;
    if (normalizedCandidate.includes(normalizedInput) || normalizedInput.includes(normalizedCandidate)) {
      return true;
    }
    return wordOverlapRatio(name, candidate.name) >= 0.5;
  });
}
