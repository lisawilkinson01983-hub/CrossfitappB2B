import Link from "next/link";
import type { ReactNode } from "react";
import type { User } from "@prisma/client";
import {
  LEVEL_LABELS,
  MONTH_NAMES,
  NEUTRAL_BADGE_CLASSES,
  PB_LABELS,
  parseDisplayedPbs,
  parseLevels,
  showsSingleBadge,
  USER_STATUS_EMOJI,
  USER_STATUS_LABELS,
} from "@/lib/labels";
import { PB_FIELDS, type PbField } from "@/lib/validation";
import { OTHER_GYM, UNAFFILIATED } from "@/lib/gyms";
import { SectionCard } from "@/components/SectionCard";
import { ExpandableHeroPhoto } from "@/components/ExpandableHeroPhoto";
import { OpenLevelBadge } from "@/components/OpenLevelBadge";
import { PbCardBody } from "@/components/PbCardBody";
import { ProfilePosts } from "@/components/ProfilePosts";
import { GymBookingButtons } from "@/components/GymBookingButtons";
import { prisma } from "@/lib/prisma";
import { isSiteAccountEmail } from "@/lib/siteAccount";
import { calculateAge } from "@/lib/age";
import { bookingMailto } from "@/lib/gymPages";

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${className}`}>{label}</span>;
}

// A small glass chip over the hero photo — the same treatment the swipe
// carousel cards already use for ability badges (see SwipeCardList).
function HeroChip({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur-sm">
      {label}
    </span>
  );
}

function VerifiedTick() {
  return (
    <span
      title="Verified affiliate"
      className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: "#e0a83a" }}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[62%] w-[62%]">
        <path d="M5 12.5 10 17 19 7" stroke="white" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export async function ProfileDetails({
  user,
  accountEmail,
  showEmail,
  followerCount,
  followingCount,
  workoutCount,
  actions,
  belowActions,
  isOwner = false,
}: {
  user: User;
  accountEmail: string;
  showEmail: boolean;
  followerCount: number;
  followingCount: number;
  workoutCount: number;
  actions?: ReactNode;
  belowActions?: ReactNode;
  isOwner?: boolean;
}) {
  const crossfitSince =
    user.crossfitSinceYear != null
      ? `${user.crossfitSinceMonth ? MONTH_NAMES[user.crossfitSinceMonth - 1] + " " : ""}${user.crossfitSinceYear}`
      : null;

  const displayedPbFields = parseDisplayedPbs(user.displayedPbs);
  const displayedPbSet = new Set(displayedPbFields);
  const pbs = displayedPbFields
    .map((field) => ({ label: PB_LABELS[field], value: user[field] }))
    .filter((pb): pb is { label: string; value: number } => pb.value != null);
  const hasMorePbs = PB_FIELDS.some((field) => user[field] != null && !displayedPbSet.has(field));
  const pbEditorInitial = {
    pbs: Object.fromEntries(PB_FIELDS.map((field) => [field, user[field] ?? ""])) as Record<PbField, number | "">,
    displayedPbs: displayedPbFields,
  };

  const isAffiliate = user.accountType === "AFFILIATE";
  // The brand account (see src/lib/siteAccount.ts) had to fill in area/gym/
  // ability/CrossFitting-since to get through profile setup like any other
  // account, but none of that means anything on its own profile page.
  const isSiteAccount = isSiteAccountEmail(accountEmail);
  const showRelationshipStatus = user.isSingle != null && user.showRelationshipStatus;
  const showSingleBadge = showsSingleBadge(user);

  const affiliateGymDisplay =
    user.affiliateGym === OTHER_GYM
      ? `Other${user.affiliateGymOther ? ` — ${user.affiliateGymOther}` : ""}`
      : user.affiliateGym;

  const isLinkableGym =
    user.affiliateGym != null && user.affiliateGym !== UNAFFILIATED && user.affiliateGym !== OTHER_GYM;
  const gymPage = isLinkableGym
    ? await prisma.gym.findUnique({ where: { name: user.affiliateGym! } })
    : null;
  const gymHref = gymPage ? `/gyms/${encodeURIComponent(gymPage.name)}` : undefined;

  // Only this profile's own verified gym (see Gym.claimedById) — a mere name
  // match isn't enough, same safety reasoning as the gym page itself (see
  // findVerifiedGymOwner). Never on your own profile: you can't book at your
  // own gym.
  const isVerifiedOwnerHere = isAffiliate && !isOwner && gymPage?.claimedById === user.id;
  const isVerifiedAffiliate = isAffiliate && user.verifiedAt != null;

  const abilityLabels = isSiteAccount ? [] : parseLevels(user.levels).map((level) => LEVEL_LABELS[level]);
  const ageLabel = user.showAge && user.dateOfBirth != null ? `${calculateAge(user.dateOfBirth)} yrs` : null;
  // Gender and "looking for" are deliberately never rendered here — both are
  // kept purely for search/discovery matching (see /discover), not shown on
  // the profile itself.

  const metaParts: ReactNode[] = [];
  if (user.area && !isSiteAccount) metaParts.push(<span key="area">{user.area}</span>);
  // Skipped for an AFFILIATE profile — its name already is the gym, so a
  // link back to the gym's own page here would be pointlessly circular.
  if (affiliateGymDisplay && !isSiteAccount && !isAffiliate) {
    metaParts.push(
      gymHref ? (
        <Link key="gym" href={gymHref} className="text-white underline decoration-white/40 hover:decoration-white">
          {affiliateGymDisplay}
        </Link>
      ) : (
        <span key="gym">{affiliateGymDisplay}</span>
      )
    );
  }
  if (crossfitSince && !isSiteAccount) {
    metaParts.push(
      <span key="since">{isAffiliate ? `Established ${crossfitSince}` : `CrossFitting since ${crossfitSince}`}</span>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-2xl border border-b2b-purple/10 bg-b2b-card shadow-sm shadow-b2b-purple/5">
        <ExpandableHeroPhoto photo={user.photo} name={user.name}>
          {user.status && (
            <div
              title={USER_STATUS_LABELS[user.status]}
              className="absolute left-3 top-3 flex h-9 items-center gap-1 rounded-full bg-black/35 px-2.5 text-sm backdrop-blur-sm"
            >
              {USER_STATUS_EMOJI[user.status]}
            </div>
          )}

          {isOwner && actions && (
            <div className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm">
              {actions}
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-5 pb-5 pt-16">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 font-display text-2xl leading-tight text-white drop-shadow-sm">
                  {user.name}
                  {isVerifiedAffiliate && <VerifiedTick />}
                  {showSingleBadge && (
                    <span title="Single" className="text-base">
                      💚
                    </span>
                  )}
                  {user.isPrivate && <span className="text-sm font-normal text-white/70">🔒 Private</span>}
                </p>
                {metaParts.length > 0 && (
                  <p className="mt-1 text-sm text-white/75">
                    {metaParts.map((part, i) => (
                      <span key={i}>
                        {i > 0 && " · "}
                        {part}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              {!isSiteAccount && !isAffiliate && user.openLevel != null && (
                <div className="shrink-0 shadow-lg">
                  <OpenLevelBadge level={user.openLevel} size="lg" />
                </div>
              )}
            </div>
            {(abilityLabels.length > 0 || ageLabel) && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {abilityLabels.map((label) => (
                  <HeroChip key={label} label={label} />
                ))}
                {ageLabel && <HeroChip label={ageLabel} />}
              </div>
            )}
          </div>
        </ExpandableHeroPhoto>

        <div className="px-5 py-5">
          {showEmail && <p className="text-sm text-b2b-ink/50">{accountEmail}</p>}

          {!isOwner && actions && <div className="flex items-center gap-2">{actions}</div>}

          {isAffiliate && user.website && (
            <a
              href={user.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded bg-b2b-purple px-4 py-2 text-sm font-medium text-white hover:bg-b2b-purple-dark"
            >
              🌐 Visit website
            </a>
          )}

          {isVerifiedOwnerHere &&
            (gymPage!.bookingEmail ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={bookingMailto(gymPage!.bookingEmail, "Intro Session", gymPage!.name)}
                  className="rounded bg-b2b-purple px-4 py-2 text-sm font-medium text-white hover:bg-b2b-purple-dark"
                >
                  Book an Intro Session
                </a>
                <a
                  href={bookingMailto(gymPage!.bookingEmail, "Drop-in", gymPage!.name)}
                  className="rounded bg-b2b-purple px-4 py-2 text-sm font-medium text-white hover:bg-b2b-purple-dark"
                >
                  Book a Drop-in
                </a>
              </div>
            ) : (
              <div className="mt-3">
                <GymBookingButtons gymId={gymPage!.id} />
              </div>
            ))}

          {belowActions}

          <div className="mt-4 flex border-t border-b2b-purple/10 pt-4">
            <Link href={`/profile/${user.id}/connections?tab=followers`} className="flex-1 text-center">
              <div className="font-display text-2xl leading-none text-b2b-ink">{followerCount}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-b2b-ink/45">Followers</div>
            </Link>
            <Link
              href={`/profile/${user.id}/connections?tab=following`}
              className="flex-1 border-l border-b2b-purple/10 text-center"
            >
              <div className="font-display text-2xl leading-none text-b2b-ink">{followingCount}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-b2b-ink/45">Following</div>
            </Link>
            {!isAffiliate && (
              <div className="flex-1 border-l border-b2b-purple/10 text-center">
                <div className="font-display text-2xl leading-none text-b2b-ink">{workoutCount}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-b2b-ink/45">Workouts</div>
              </div>
            )}
          </div>

          {showRelationshipStatus && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/40">Relationship Status</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Badge label={user.isSingle ? "Single" : "In a relationship"} className={NEUTRAL_BADGE_CLASSES} />
              </div>
            </div>
          )}

          {user.bio && <p className="mt-4 max-w-sm text-sm italic text-b2b-ink/70">&ldquo;{user.bio}&rdquo;</p>}
        </div>
      </div>

      <ProfilePosts userId={user.id} isOwner={isOwner} />

      {!isAffiliate && (
        <SectionCard
          title="Key PBs (kg)"
          action={
            hasMorePbs && (
              <Link href={`/profile/${user.id}/pbs`} className="text-sm text-b2b-pink underline">
                See all
              </Link>
            )
          }
        >
          <PbCardBody pbs={pbs} isOwner={isOwner} editorInitial={pbEditorInitial} />
        </SectionCard>
      )}
    </div>
  );
}
