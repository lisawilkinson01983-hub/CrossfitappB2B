import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AFFILIATE_GYMS } from "@/lib/gyms";
import { ensureGymPage } from "@/lib/gymPages";
import { Avatar } from "@/components/Avatar";
import { SectionCard } from "@/components/SectionCard";
import { DISTANCE_RANGES, distanceMiles, ensureUserAreaCoords, geocode } from "@/lib/geocode";

export type AffiliateSearchParams = {
  q?: string;
  distance?: string;
};

// Gyms are a fixed list (no in-app creation form), so they may not have been
// geocoded yet — do it lazily on first read and cache the result on the row.
async function ensureGymCoords(gym: { name: string; address: string | null; lat: number | null; lng: number | null }) {
  if (gym.lat !== null && gym.lng !== null) return { lat: gym.lat, lng: gym.lng };
  if (!gym.address) return null;

  const coords = await geocode(gym.address);
  if (!coords) return null;

  await prisma.gym.update({ where: { name: gym.name }, data: { lat: coords.lat, lng: coords.lng } });
  return coords;
}

/**
 * The fixed list of local affiliate gyms, browsable even before any athlete
 * has joined one — useful for someone deciding whether to switch boxes.
 * ensureGymPage guarantees a row (with known public details, where we have
 * them) exists for each, independent of anyone picking it as their gym.
 */
export async function AffiliatesList({
  sp,
  currentUserId,
}: {
  sp: AffiliateSearchParams;
  currentUserId: string;
}) {
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const distance = DISTANCE_RANGES.find((d) => String(d) === sp.distance);

  await Promise.all(AFFILIATE_GYMS.map((name) => ensureGymPage(name)));

  const [gyms, athleteCounts, currentUser] = await Promise.all([
    prisma.gym.findMany({ where: { name: { in: AFFILIATE_GYMS as unknown as string[] } } }),
    prisma.user.groupBy({
      by: ["affiliateGym"],
      where: { affiliateGym: { in: AFFILIATE_GYMS as unknown as string[] } },
      _count: true,
    }),
    prisma.user.findUnique({
      where: { id: currentUserId },
      select: { area: true, areaLat: true, areaLng: true },
    }),
  ]);

  const myCoords = currentUser
    ? await ensureUserAreaCoords({ id: currentUserId, ...currentUser })
    : null;

  const gymByName = new Map(gyms.map((g) => [g.name, g]));
  const countByName = new Map(athleteCounts.map((c) => [c.affiliateGym as string, c._count]));

  const gymsWithDistance = await Promise.all(
    AFFILIATE_GYMS.map(async (name) => {
      const gym = gymByName.get(name);
      const coords = myCoords && gym ? await ensureGymCoords(gym) : null;
      const miles = coords && myCoords ? distanceMiles(myCoords, coords) : null;
      return { name, gym, miles };
    })
  );

  const visibleGyms = gymsWithDistance.filter(({ name, gym, miles }) => {
    if (distance && (miles === null || miles > distance)) return false;
    if (!q) return true;
    return name.toLowerCase().includes(q) || gym?.address?.toLowerCase().includes(q);
  });

  return (
    <div className="mt-4 flex flex-col gap-6">
      <SectionCard>
        <form method="GET" className="flex flex-col gap-4">
          <input type="hidden" name="view" value="affiliates" />
          <div>
            <label htmlFor="q" className="block text-sm font-medium">
              Search affiliates
            </label>
            <input
              id="q"
              name="q"
              type="text"
              placeholder="Search by gym name or area"
              defaultValue={q}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="distance" className="block text-sm font-medium">
              Distance
            </label>
            <select
              id="distance"
              name="distance"
              defaultValue={distance ? String(distance) : ""}
              disabled={!myCoords}
              className="mt-1 w-full max-w-xs rounded border border-gray-300 bg-b2b-card px-3 py-2 focus:border-b2b-pink focus:outline-none disabled:opacity-50"
            >
              <option value="">Any distance</option>
              {DISTANCE_RANGES.map((d) => (
                <option key={d} value={d}>
                  Within {d} miles
                </option>
              ))}
            </select>
            {!myCoords && (
              <p className="mt-1 text-xs text-b2b-ink/40">
                Set your area on your profile to filter affiliates by distance.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark"
            >
              Search
            </button>
            <Link href="/discover?view=affiliates" className="self-center text-sm text-b2b-ink/50 hover:underline">
              Clear filters
            </Link>
          </div>
        </form>
      </SectionCard>

      {visibleGyms.length === 0 ? (
        <p className="text-b2b-ink/50">No affiliates match those filters.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleGyms.map(({ name, gym, miles }) => {
            const athleteCount = countByName.get(name) ?? 0;

            return (
              <Link
                key={name}
                href={`/gyms/${encodeURIComponent(name)}`}
                className="flex items-center gap-3 rounded-xl border border-b2b-purple/10 bg-b2b-card p-4 hover:border-b2b-pink"
              >
                <Avatar photo={gym?.photo ?? null} name={name} size={48} />
                <div className="flex-1">
                  <p className="font-medium">{name}</p>
                  {gym?.address && (
                    <p className="text-sm text-b2b-ink/50">
                      {gym.address}
                      {miles !== null && <> · {miles < 1 ? "<1" : Math.round(miles)} miles away</>}
                    </p>
                  )}
                  <p className="text-xs text-b2b-ink/40">
                    {athleteCount} {athleteCount === 1 ? "athlete" : "athletes"} on Box 2 Box
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
