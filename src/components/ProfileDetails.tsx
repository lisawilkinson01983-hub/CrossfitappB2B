import Link from "next/link";
import type { ReactNode } from "react";
import type { User } from "@prisma/client";
import {
  GENDER_LABELS,
  LEVEL_BADGE_CLASSES,
  LEVEL_LABELS,
  LOOKING_FOR_LABELS,
  MONTH_NAMES,
  PB_LABELS,
  parseDisplayedPbs,
  parseLookingFor,
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
  actions,
  belowActions,
  isOwner = false,
}: {
  user: User;
  accountEmail: string;
  showEmail: boolean;
  followerCount: number;
  followingCount: number;
  actions?: ReactNode;
  belowActions?: ReactNode;
  isOwner?: boolean;
}) {
  const lookingFor = parseLookingFor(user.lookingFor);
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
  if (user.gender) {
    badges.push(
      <Badge key="gender" label={GENDER_LABELS[user.gender]} className="bg-gray-100 text-gray-600" />
    );
  }
  if (showRelationshipStatus) {
    badges.push(
      <Badge
        key="relationship"
        label={user.isSingle ? "Single" : "Not single"}
        className="bg-gray-100 text-gray-600"
      />
    );
  }
  if (user.showLookingFor && lookingFor.length > 0) {
    for (const tag of lookingFor) {
      badges.push(
        <Badge key={`lf-${tag}`} label={LOOKING_FOR_LABELS[tag]} className="bg-b2b-purple/10 text-b2b-purple" />
      );
    }
  }

  const metaParts: ReactNode[] = [];
  if (user.area && !isSiteAccount) metaParts.push(<span key="area">{user.area}</span>);
  if (affiliateGymDisplay && !isSiteAccount) {
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
      <SectionCard>
        <div className="flex flex-col items-center gap-3 text-center">
          <ExpandableAvatar photo={user.photo} name={user.name} size={112} showSingleBadge={showSingleBadge} />

          <div>
            <p className="text-xl font-semibold">
              {user.name}
              {isAffiliate && user.verifiedAt && (
                <span className="ml-2 align-middle text-sm font-normal text-b2b-pink" title="Verified affiliate">
                  ✓ Verified
                </span>
              )}
              {user.isPrivate && (
                <span className="ml-2 align-middle text-sm font-normal text-b2b-ink/50">🔒 Private</span>
              )}
            </p>
            {showEmail && <p className="text-sm text-b2b-ink/50">{accountEmail}</p>}
          </div>

          {actions && <div className="flex items-center gap-2">{actions}</div>}

          <div className="flex gap-4 text-sm">
            <Link href={`/profile/${user.id}/connections?tab=followers`} className="text-b2b-pink underline">
              {followerCount} followers
            </Link>
            <Link href={`/profile/${user.id}/connections?tab=following`} className="text-b2b-pink underline">
              {followingCount} following
            </Link>
          </div>

          {isAffiliate && user.website && (
            <a
              href={user.website}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-b2b-purple/20 px-4 py-1.5 text-sm font-medium text-b2b-purple hover:border-b2b-purple"
            >
              🌐 Visit website
            </a>
          )}

          {isVerifiedOwnerHere &&
            (gymPage!.bookingEmail ? (
              <div className="flex flex-wrap justify-center gap-2">
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
              <GymBookingButtons gymId={gymPage!.id} />
            ))}

          {belowActions}

          {user.bio && <p className="max-w-sm text-sm italic text-b2b-ink/70">&ldquo;{user.bio}&rdquo;</p>}

          {badges.length > 0 && <div className="flex flex-wrap justify-center gap-2">{badges}</div>}

          {metaParts.length > 0 && (
            <p className="text-sm text-b2b-ink/50">
              {metaParts.map((part, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  {part}
                </span>
              ))}
            </p>
          )}
        </div>
      </SectionCard>

      <ProfilePosts userId={user.id} />

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
