import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AFFILIATE_GYMS } from "@/lib/gyms";
import { ensureGymPage } from "@/lib/gymPages";
import { Avatar } from "@/components/Avatar";
import { SectionCard } from "@/components/SectionCard";

export type AffiliateSearchParams = {
  q?: string;
};

/**
 * The fixed list of local affiliate gyms, browsable even before any athlete
 * has joined one — useful for someone deciding whether to switch boxes.
 * ensureGymPage guarantees a row (with known public details, where we have
 * them) exists for each, independent of anyone picking it as their gym.
 */
export async function AffiliatesList({ sp }: { sp: AffiliateSearchParams }) {
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";

  await Promise.all(AFFILIATE_GYMS.map((name) => ensureGymPage(name)));

  const [gyms, athleteCounts] = await Promise.all([
    prisma.gym.findMany({ where: { name: { in: AFFILIATE_GYMS as unknown as string[] } } }),
    prisma.user.groupBy({
      by: ["affiliateGym"],
      where: { affiliateGym: { in: AFFILIATE_GYMS as unknown as string[] } },
      _count: true,
    }),
  ]);

  const gymByName = new Map(gyms.map((g) => [g.name, g]));
  const countByName = new Map(athleteCounts.map((c) => [c.affiliateGym as string, c._count]));

  const visibleGyms = AFFILIATE_GYMS.filter((name) => {
    if (!q) return true;
    const gym = gymByName.get(name);
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
        <p className="text-b2b-ink/50">No affiliates match that search.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleGyms.map((name) => {
            const gym = gymByName.get(name);
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
                  {gym?.address && <p className="text-sm text-b2b-ink/50">{gym.address}</p>}
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
