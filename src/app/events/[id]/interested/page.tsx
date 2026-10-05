import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { Avatar } from "@/components/Avatar";
import { MessageButton } from "@/components/MessageButton";
import { GENDER_LABELS, LEVEL_BADGE_CLASSES, LEVEL_LABELS, parseLevels, showsSingleBadge } from "@/lib/labels";
import { GENDERS, LEVELS } from "@/lib/validation";
import { assertEventVisible } from "@/lib/eventVisibility";

// "Prefer not to disclose" is a profile-level privacy choice, not a search filter.
const SEARCHABLE_GENDERS = GENDERS.filter((g) => g !== "PREFER_NOT_TO_DISCLOSE");

/**
 * Everyone currently marked "interested" in this event — i.e. still looking
 * for a team, since marking "participating" clears interest (see
 * /api/events/[id]/participate). A quick way to browse (or search by name)
 * for a teammate without needing the structured ability/gender matching in
 * the Notice Board's "looking for teammates" requests.
 */
export default async function EventInterestedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; level?: string; gender?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const { q: qRaw, level: levelRaw, gender: genderRaw } = await searchParams;
  const q = typeof qRaw === "string" ? qRaw.trim() : "";
  const level = LEVELS.find((l) => l === levelRaw);
  const gender = SEARCHABLE_GENDERS.find((g) => g === genderRaw);
  const hasFilters = !!q || !!level || !!gender;

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      isPrivate: true,
      status: true,
      createdById: true,
      submittedById: true,
      interests: {
        where: {
          userId: { not: session.user.id },
          user: {
            ...(q ? { name: { contains: q } } : {}),
            // levels is a JSON-encoded array (see prisma/schema.prisma) —
            // none of SCALED/INTERMEDIATE/RX is a substring of another, so
            // "contains" safely means "has this level among theirs".
            ...(level ? { levels: { contains: level } } : {}),
            ...(gender ? { gender } : {}),
          },
        },
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              photo: true,
              levels: true,
              affiliateGym: true,
              isSingle: true,
              showSingleBadge: true,
            },
          },
        },
      },
    },
  });
  if (!event) notFound();
  if (!(await assertEventVisible(event, session.user.id))) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href={`/events/${event.id}`} className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to {event.name}
      </Link>

      <div className="mt-4 flex flex-col gap-4">
        <SectionCard>
          <p className="text-sm text-b2b-ink/50">
            Athletes still looking for a team for {event.name} — browse below, search by name, or filter by ability
            and gender.
          </p>
          <form method="GET" className="mt-3 flex flex-col gap-3">
            <div>
              <label htmlFor="q" className="sr-only">
                Search interested athletes by name
              </label>
              <input
                id="q"
                name="q"
                type="text"
                placeholder="Search by name"
                defaultValue={q}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-b2b-pink focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="level" className="block text-xs font-medium text-b2b-ink/60">
                  Ability
                </label>
                <select
                  id="level"
                  name="level"
                  defaultValue={level ?? ""}
                  className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-2 py-2 text-sm focus:border-b2b-pink focus:outline-none"
                >
                  <option value="">Any</option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_LABELS[l]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="gender" className="block text-xs font-medium text-b2b-ink/60">
                  Gender
                </label>
                <select
                  id="gender"
                  name="gender"
                  defaultValue={gender ?? ""}
                  className="mt-1 w-full rounded border border-gray-300 bg-b2b-card px-2 py-2 text-sm focus:border-b2b-pink focus:outline-none"
                >
                  <option value="">Any</option>
                  {SEARCHABLE_GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {GENDER_LABELS[g]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark"
            >
              Search
            </button>
          </form>
          {hasFilters && (
            <Link href={`/events/${event.id}/interested`} className="mt-2 inline-block text-xs text-b2b-ink/50 hover:underline">
              Clear filters
            </Link>
          )}
        </SectionCard>

        <SectionCard
          title={`${event.interests.length} ${event.interests.length === 1 ? "athlete" : "athletes"} interested`}
        >
          {event.interests.length === 0 ? (
            <p className="text-b2b-ink/40">
              {hasFilters ? "No one matching those filters yet." : "No one's marked interested yet — check back later."}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {event.interests.map((interest) => (
                <div key={interest.id} className="flex items-center justify-between gap-3">
                  <Link href={`/profile/${interest.user.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar
                      photo={interest.user.photo}
                      name={interest.user.name}
                      size={40}
                      showSingleBadge={showsSingleBadge(interest.user)}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {interest.user.name}
                        {parseLevels(interest.user.levels).map((level) => (
                          <span key={level} className={`ml-2 rounded-full px-2 py-0.5 text-xs ${LEVEL_BADGE_CLASSES[level]}`}>
                            {LEVEL_LABELS[level]}
                          </span>
                        ))}
                      </p>
                      {interest.user.affiliateGym && (
                        <p className="truncate text-xs text-b2b-ink/40">{interest.user.affiliateGym}</p>
                      )}
                    </div>
                  </Link>
                  <MessageButton targetUserId={interest.user.id} compact />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
