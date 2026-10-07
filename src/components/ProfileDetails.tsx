import Link from "next/link";
import type { ReactNode } from "react";
import type { User } from "@prisma/client";
import {
  LEVEL_BADGE_CLASSES,
  LEVEL_LABELS,
  MONTH_NAMES,
  PB_LABELS,
  parseDisplayedPbs,
  parseLevels,
  showsSingleBadge,
} from "@/lib/labels";
import { PB_FIELDS, type PbField } from "@/lib/validation";
import { OTHER_GYM, UNAFFILIATED } from "@/lib/gyms";
import { SectionCard } from "@/components/SectionCard";
import { ExpandableAvatar } from "@/components/ExpandableAvatar";
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

  const badges: ReactNode[] = [];
  if (!isSiteAccount) {
    for (const level of parseLevels(user.levels)) {
      badges.push(<Badge key={`level-${level}`} label={LEVEL_LABELS[level]} className={LEVEL_BADGE_CLASSES[level]} />);
    }
  }
  if (user.showAge && user.dateOfBirth != null) {
    badges.push(
      <Badge key="age" label={`${calculateAge(user.dateOfBirth)} yrs`} className="bg-gray-100 text-gray-600" />
    );
  }
  // Gender and "looking for" are deliberately never rendered here — both are
  // kept purely for search/discovery matching (see /discover), not shown on
  // the profile itself.
  if (showRelationshipStatus) {
    badges.push(
      <Badge
        key="relationship"
        label={user.isSingle ? "Single" : "Not single"}
        className="bg-gray-100 text-gray-600"
      />
    );
  }

  const metaParts: ReactNode[] = [];
  if (user.area && !isSiteAccount) metaParts.push(<span key="area">{user.area}</span>);
  // Skipped for an AFFILIATE profile — its name already is the gym, so a
  // link back to the gym's own page here would be pointlessly circular.
  if (affiliateGymDisplay && !isSiteAccount && !isAffiliate) {
    metaParts.push(
      gymHref ? (
        <Link key="gym" href={gymHref} className="text-b2b-pink underline">
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
        <div
          className="h-28 bg-b2b-ink"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(184,132,42,0.14) 0px, rgba(184,132,42,0.14) 2px, transparent 2px, transparent 18px)",
          }}
        />

        <div className="px-5 pb-5">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <div className="rounded-full ring-4 ring-b2b-card" style={{ width: 84, height: 84 }}>
              <ExpandableAvatar
                photo={user.photo}
                name={user.name}
                size={84}
                showSingleBadge={showSingleBadge}
                verified={isAffiliate && user.verifiedAt != null}
              />
            </div>
            {actions && <div className="mb-1 flex items-center gap-2">{actions}</div>}
          </div>

          <div className="mt-3">
            <p className="flex flex-wrap items-center gap-2 text-xl font-semibold">
              {user.name}
              {user.isPrivate && (
                <span className="text-sm font-normal text-b2b-ink/50">🔒 Private</span>
              )}
            </p>
            {showEmail && <p className="text-sm text-b2b-ink/50">{accountEmail}</p>}
            {metaParts.length > 0 && (
              <p className="mt-0.5 text-sm text-b2b-ink/50">
                {metaParts.map((part, i) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    {part}
                  </span>
                ))}
              </p>
            )}
          </div>

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
              <div className="text-lg font-bold text-b2b-ink">{followerCount}</div>
              <div className="text-[11px] uppercase tracking-wide text-b2b-ink/45">Followers</div>
            </Link>
            <Link
              href={`/profile/${user.id}/connections?tab=following`}
              className="flex-1 border-l border-b2b-purple/10 text-center"
            >
              <div className="text-lg font-bold text-b2b-ink">{followingCount}</div>
              <div className="text-[11px] uppercase tracking-wide text-b2b-ink/45">Following</div>
            </Link>
            {!isAffiliate && (
              <div className="flex-1 border-l border-b2b-purple/10 text-center">
                <div className="text-lg font-bold text-b2b-ink">{workoutCount}</div>
                <div className="text-[11px] uppercase tracking-wide text-b2b-ink/45">Workouts</div>
              </div>
            )}
          </div>

          {badges.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{badges}</div>}

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
