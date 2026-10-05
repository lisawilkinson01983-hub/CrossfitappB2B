import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AFFILIATE_GYMS } from "@/lib/gyms";
import { ensureGymPage } from "@/lib/gymPages";
import { Avatar } from "@/components/Avatar";
import { SectionCard } from "@/components/SectionCard";
import { DISTANCE_RANGES, distanceMiles, ensureUserAreaCoords, geocode } from "@/lib/geocode";
import { SearchSuggestInput } from "@/components/SearchSuggestInput";
import { SearchFilters } from "@/components/SearchFilters";

export type AffiliateSearchParams = {
  q?: string;
  distance?: string;
};

// Gyms in the fixed list may not have been geocoded yet — do it lazily on
// first read and cache the result on the row. User-submitted gyms are
// geocoded from their submitted address the same way. Queued in the
// background rather than awaited: this list renders on every Discover
// visit, and waiting on a live external geocode call for every not-yet-
// cached gym turned a single page view into several seconds of waiting.
function ensureGymCoords(gym: { name: string; address: string | null; lat: number | null; lng: number | null }) {
  if (gym.lat !== null && gym.lng !== null) return Promise.resolve({ lat: gym.lat, lng: gym.lng });
  if (gym.address) queueGymGeocode(gym.name, gym.address);
  return Promise.resolve(null);
}

// One lookup at a time, about a second apart, per Nominatim's usage policy
// (max 1 request/second) — a batch of newly added gyms would otherwise fire
// dozens of requests at once on the first Affiliates visit and get the app
// rate-limited. A gym already queued isn't queued twice.
const geocodeQueue = new Map<string, string>();
let geocodeQueueRunning = false;

function queueGymGeocode(name: string, address: string) {
  if (geocodeQueue.has(name)) return;
  geocodeQueue.set(name, address);
  if (!geocodeQueueRunning) void runGeocodeQueue();
}

async function runGeocodeQueue() {
  geocodeQueueRunning = true;
  try {
    for (const [name, address] of geocodeQueue) {
      try {
        const coords = await geocodeAddress(address);
        if (coords) await prisma.gym.update({ where: { name }, data: { lat: coords.lat, lng: coords.lng } });
      } catch {
        // Best-effort: a failed lookup is retried on a later visit.
      }
      geocodeQueue.delete(name);
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  } finally {
    geocodeQueueRunning = false;
  }
}

// Nominatim often finds nothing for a full UK street address that leads
// with a unit or building name ("Unit 19, Gaza Trading Estate, …"), so fall
// back to just its postcode, which it reliably knows.
const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

async function geocodeAddress(address: string) {
  const coords = await geocode(address);
  if (coords) return coords;
  const postcode = address.match(UK_POSTCODE);
  if (!postcode) return null;
  await new Promise((resolve) => setTimeout(resolve, 1100));
  return geocode(`${postcode[1]} ${postcode[2]}, UK`);
}

/**
 * The fixed list of local affiliate gyms is browsable even before any
 * athlete has joined one, alongside any gym someone's submitted via
 * /gyms/submit and had approved — a mixed directory of curated and
 * user-submitted affiliates. ensureGymPage guarantees a row (with known
 * public details, where we have them) exists for each fixed gym,
 * independent of anyone picking it as their own affiliate.
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
  const activeFilterCount = distance ? 1 : 0;

  // Only create the curated gyms that are missing a row — upserting all of
  // them on every Discover visit got heavy as the list grew. Filling in
  // details on existing rows is left to the deploy-time backfill
  // (scripts/backfill-gym-pages.js) and ensureGymPage on profile save.
  const existingGymNames = new Set(
    (await prisma.gym.findMany({ where: { name: { in: [...AFFILIATE_GYMS] } }, select: { name: true } })).map(
      (g) => g.name
    )
  );
  await Promise.all(AFFILIATE_GYMS.filter((name) => !existingGymNames.has(name)).map((name) => ensureGymPage(name)));

  const [gyms, currentUser, pendingCount] = await Promise.all([
    prisma.gym.findMany({
      where: { status: "APPROVED" },
      orderBy: { name: "asc" },
      include: { claimedBy: { select: { id: true, photo: true } } },
    }),
    prisma.user.findUnique({
      where: { id: currentUserId },
      select: { area: true, areaLat: true, areaLng: true, isAdmin: true },
    }),
    prisma.gym.count({ where: { status: "PENDING" } }),
  ]);

  const athleteCounts = await prisma.user.groupBy({
    by: ["affiliateGym"],
    where: { affiliateGym: { in: gyms.map((g) => g.name) } },
    _count: true,
  });
  const countByName = new Map(athleteCounts.map((c) => [c.affiliateGym as string, c._count]));

  // Only worth cluttering the browse list with a gym once someone's actually
  // representing it — either claimed (a verified owner, see Gym.claimedById)
  // or at least one AFFILIATE profile has picked it, even unverified. A
  // seeded or submitted gym nobody's touched yet stays out of this list, but
  // is still selectable in the signup/profile affiliateGym dropdown and
  // reachable via an athlete's own "affiliate tag" link to /gyms/[name].
  // Admins see everything regardless, so a not-yet-represented gym can still
  // be found and edited.
  const affiliateProfiles = await prisma.user.findMany({
    where: { accountType: "AFFILIATE", affiliateGym: { in: gyms.map((g) => g.name) }, deletedAt: null },
    select: { affiliateGym: true },
  });
  const gymNamesWithAffiliate = new Set(affiliateProfiles.map((p) => p.affiliateGym as string));
  const isRepresented = (gym: (typeof gyms)[number]) =>
    gym.claimedById !== null || gymNamesWithAffiliate.has(gym.name);
  const representedGyms = currentUser?.isAdmin ? gyms : gyms.filter(isRepresented);

  const myCoords = currentUser
    ? await ensureUserAreaCoords({ id: currentUserId, ...currentUser }, { background: true })
    : null;

  const gymsWithDistance = await Promise.all(
    representedGyms.map(async (gym) => {
      const coords = myCoords ? await ensureGymCoords(gym) : null;
      const miles = coords && myCoords ? distanceMiles(myCoords, coords) : null;
      return { gym, miles };
    })
  );

  const visibleGyms = gymsWithDistance.filter(({ gym, miles }) => {
    if (distance && (miles === null || miles > distance)) return false;
    if (!q) return true;
    return gym.name.toLowerCase().includes(q) || gym.address?.toLowerCase().includes(q);
  });

  return (
    <div className="mt-4 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href="/gyms/submit"
          className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark"
        >
          Add Affiliate
        </Link>
        {currentUser?.isAdmin && (
          <Link href="/gyms/review" className="text-sm text-b2b-purple underline">
            Review submissions{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Link>
        )}
      </div>

      <SectionCard>
        <form method="GET" className="flex flex-col gap-4">
          <input type="hidden" name="view" value="affiliates" />
          <div>
            <label htmlFor="q" className="block text-sm font-medium">
              Search affiliates
            </label>
            <SearchSuggestInput
              kind="gym"
              id="q"
              name="q"
              placeholder="Search by gym name or area"
              defaultValue={q}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-b2b-pink focus:outline-none"
            />
          </div>
          <SearchFilters activeCount={activeFilterCount} defaultOpen={activeFilterCount > 0}>
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
          </SearchFilters>
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

        <p className="mt-4 text-sm text-b2b-ink/50">
          Can't find your affiliate? Click "Add Affiliate" to add it to the listings (subject to review). Please
          check the affiliate hasn't already been added to avoid duplication.
        </p>
      </SectionCard>

      {visibleGyms.length === 0 ? (
        <p className="text-b2b-ink/50">No affiliates match those filters.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleGyms.map(({ gym, miles }) => {
            const athleteCount = countByName.get(gym.name) ?? 0;

            return (
              <div
                key={gym.id}
                className="flex items-center gap-3 rounded-xl border border-b2b-purple/10 bg-b2b-card p-4 hover:border-b2b-pink"
              >
                <Link href={`/gyms/${encodeURIComponent(gym.name)}`} className="flex flex-1 items-center gap-3">
                  <Avatar fallback="gym" photo={gym.claimedBy?.photo ?? gym.photo} name={gym.name} size={48} />
                  <div className="flex-1">
                    <p className="font-medium">{gym.name}</p>
                    {gym.address && (
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
                {currentUser?.isAdmin && (
                  <Link
                    href={`/gyms/${encodeURIComponent(gym.name)}/edit`}
                    className="shrink-0 text-xs text-b2b-purple underline"
                  >
                    Edit
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
