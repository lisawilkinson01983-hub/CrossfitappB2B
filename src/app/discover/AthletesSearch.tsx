import Link from "next/link";
import Image from "next/image";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FollowButton, type FollowStatus } from "@/components/FollowButton";
import { BlockMuteControls } from "@/components/BlockMuteControls";
import { GENDERS, LEVELS, LOOKING_FOR_OPTIONS, type LookingForOption } from "@/lib/validation";
import { GENDER_LABELS, LEVEL_LABELS, LOOKING_FOR_LABELS, parseLookingFor } from "@/lib/labels";
import { GYM_OPTIONS } from "@/lib/gyms";

// "Prefer not to disclose" is a profile-level privacy choice, not a search filter.
const SEARCHABLE_GENDERS = GENDERS.filter((g) => g !== "PREFER_NOT_TO_DISCLOSE");

export type AthleteSearchParams = {
  gym?: string;
  area?: string;
  gender?: string;
  level?: string;
  lookingFor?: string | string[];
};

export async function AthletesSearch({
  sp,
  currentUserId,
}: {
  sp: AthleteSearchParams;
  currentUserId: string;
}) {
  const gym = typeof sp.gym === "string" ? sp.gym.trim() : "";
  const area = typeof sp.area === "string" ? sp.area.trim() : "";
  const gender = SEARCHABLE_GENDERS.find((g) => g === sp.gender);
  const level = LEVELS.find((l) => l === sp.level);
  const lookingForRaw = Array.isArray(sp.lookingFor) ? sp.lookingFor : sp.lookingFor ? [sp.lookingFor] : [];
  const lookingForFilter = lookingForRaw.filter((v): v is LookingForOption =>
    LOOKING_FOR_OPTIONS.includes(v as LookingForOption)
  );

  const blocked = await prisma.block.findMany({
    where: { blockerId: currentUserId },
    select: { blockedId: true },
  });

  const where: Prisma.UserWhereInput = {
    id: { not: currentUserId, notIn: blocked.map((b) => b.blockedId) },
    ...(gym ? { affiliateGym: { contains: gym } } : {}),
    ...(area ? { area: { contains: area } } : {}),
    ...(gender ? { gender } : {}),
    ...(level ? { level } : {}),
  };

  let results = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      photo: true,
      level: true,
      area: true,
      affiliateGym: true,
      isPrivate: true,
      lookingFor: true,
    },
    orderBy: { name: "asc" },
  });

  // The DB can't query the JSON-encoded lookingFor column, so this filter runs
  // in memory over the already-narrowed candidate set (fine at POC scale).
  if (lookingForFilter.length) {
    results = results.filter((u) =>
      parseLookingFor(u.lookingFor).some((tag) => lookingForFilter.includes(tag))
    );
  }

  const resultIds = results.map((r) => r.id);
  const [myFollows, myPendingRequests, myMutes] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: currentUserId, followingId: { in: resultIds } },
      select: { followingId: true },
    }),
    prisma.followRequest.findMany({
      where: { requesterId: currentUserId, targetId: { in: resultIds }, status: "PENDING" },
      select: { targetId: true },
    }),
    prisma.mute.findMany({
      where: { userId: currentUserId, mutedUserId: { in: resultIds } },
      select: { mutedUserId: true },
    }),
  ]);
  const myFollowingIds = new Set(myFollows.map((f) => f.followingId));
  const myPendingIds = new Set(myPendingRequests.map((r) => r.targetId));
  const myMutedIds = new Set(myMutes.map((m) => m.mutedUserId));

  return (
    <>
      <form method="GET" className="mt-4 flex flex-col gap-4 rounded border border-gray-200 bg-white p-4">
        <input type="hidden" name="view" value="athletes" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="gym" className="block text-sm font-medium">
              Affiliate gym
            </label>
            <select
              id="gym"
              name="gym"
              defaultValue={gym}
              className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Any</option>
              {GYM_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="area" className="block text-sm font-medium">
              Area
            </label>
            <input
              id="area"
              name="area"
              type="text"
              defaultValue={area}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="gender" className="block text-sm font-medium">
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              defaultValue={gender ?? ""}
              className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Any</option>
              {SEARCHABLE_GENDERS.map((g) => (
                <option key={g} value={g}>
                  {GENDER_LABELS[g]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="level" className="block text-sm font-medium">
              Level
            </label>
            <select
              id="level"
              name="level"
              defaultValue={level ?? ""}
              className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Any</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Looking for</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {LOOKING_FOR_OPTIONS.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="lookingFor"
                  value={option}
                  defaultChecked={lookingForFilter.includes(option)}
                />
                {LOOKING_FOR_LABELS[option]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Search
          </button>
          <Link href="/discover" className="self-center text-sm text-gray-500 hover:underline">
            Clear filters
          </Link>
        </div>
      </form>

      {results.length === 0 ? (
        <p className="mt-6 text-gray-500">No athletes match those filters.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {results.map((user) => {
            const status: FollowStatus = myFollowingIds.has(user.id)
              ? "following"
              : myPendingIds.has(user.id)
                ? "pending"
                : "none";

            return (
              <div
                key={user.id}
                className="flex items-center justify-between rounded border border-gray-200 bg-white p-3"
              >
                <Link href={`/profile/${user.id}`} className="flex items-center gap-3">
                  {user.photo ? (
                    <Image
                      src={user.photo}
                      alt={user.name}
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-500">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">
                      {user.name}
                      {user.isPrivate && <span className="ml-1 text-sm">🔒</span>}
                      {user.level && (
                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {LEVEL_LABELS[user.level]}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">
                      {[user.area, user.affiliateGym].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </Link>
                <div className="flex flex-col items-end gap-1">
                  <FollowButton targetUserId={user.id} initialStatus={status} />
                  <BlockMuteControls
                    targetUserId={user.id}
                    initialBlocked={false}
                    initialMuted={myMutedIds.has(user.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
