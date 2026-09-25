import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { distanceMiles, ensureUserAreaCoords, geocode } from "@/lib/geocode";
import type { noticeAudienceSchema } from "@/lib/validation";

type Audience = z.infer<typeof noticeAudienceSchema>;

const DEFAULT_RADIUS_MILES = 25;

/**
 * Resolves an admin-chosen audience (see /admin/notices) to the ids of every
 * matching, contactable user. Every field on `audience` narrows further —
 * none set at all means everyone. Excludes deleted/suspended accounts (same
 * as every other user-facing query) and, when given, the site account itself
 * so Box 2 Box never ends up notifying itself.
 */
export async function resolveAudienceUserIds(audience: Audience, excludeUserId: string | null): Promise<string[]> {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    suspendedAt: null,
    ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    ...(audience.gender ? { gender: audience.gender } : {}),
    ...(audience.level ? { level: audience.level } : {}),
    ...(audience.affiliateGym ? { affiliateGym: audience.affiliateGym } : {}),
    ...(audience.country ? { country: audience.country } : {}),
    ...(audience.minAge !== undefined || audience.maxAge !== undefined
      ? { age: { gte: audience.minAge, lte: audience.maxAge } }
      : {}),
  };

  const candidates = await prisma.user.findMany({
    where,
    select: { id: true, area: true, areaLat: true, areaLng: true },
  });

  if (!audience.areaQuery) {
    return candidates.map((c) => c.id);
  }

  // An area was typed but couldn't be geocoded — no safe way to know who's
  // "near" it, so match no one rather than silently falling back to everyone.
  const center = await geocode(audience.areaQuery);
  if (!center) return [];

  const radius = audience.radiusMiles ?? DEFAULT_RADIUS_MILES;
  const withDistance = await Promise.all(
    candidates.map(async (user) => {
      const coords = await ensureUserAreaCoords(user);
      const miles = coords ? distanceMiles(center, coords) : null;
      return { id: user.id, miles };
    })
  );

  return withDistance.filter(({ miles }) => miles !== null && miles! <= radius).map((c) => c.id);
}
