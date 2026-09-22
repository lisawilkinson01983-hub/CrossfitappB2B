import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AFFILIATE_GYMS } from "@/lib/gyms";
import { ensureGymPage } from "@/lib/gymPages";
import { Avatar } from "@/components/Avatar";

/**
 * The fixed list of local affiliate gyms, browsable even before any athlete
 * has joined one — useful for someone deciding whether to switch boxes.
 * ensureGymPage guarantees a row (with known public details, where we have
 * them) exists for each, independent of anyone picking it as their gym.
 */
export async function AffiliatesList() {
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

  return (
    <div className="mt-4 flex flex-col gap-3">
      {AFFILIATE_GYMS.map((name) => {
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
  );
}
