import Image from "next/image";
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
  parseLookingFor,
} from "@/lib/labels";
import { PB_FIELDS } from "@/lib/validation";
import { AFFILIATE_GYMS, OTHER_GYM } from "@/lib/gyms";
import { SectionCard } from "@/components/SectionCard";
import { prisma } from "@/lib/prisma";

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${className}`}>{label}</span>;
}

export async function ProfileDetails({
  user,
  showEmail,
  followerCount,
  followingCount,
  actions,
  belowActions,
}: {
  user: User;
  showEmail: boolean;
  followerCount: number;
  followingCount: number;
  actions?: ReactNode;
  belowActions?: ReactNode;
}) {
  const lookingFor = parseLookingFor(user.lookingFor);
  const crossfitSince =
    user.crossfitSinceYear != null
      ? `${user.crossfitSinceMonth ? MONTH_NAMES[user.crossfitSinceMonth - 1] + " " : ""}${user.crossfitSinceYear}`
      : null;

  const pbs = PB_FIELDS.map((field) => ({ label: PB_LABELS[field], value: user[field] })).filter(
    (pb) => pb.value != null
  );

  const showRelationshipStatus = user.isSingle != null && user.showRelationshipStatus;
  const showSingleBadge = user.isSingle === true && user.showSingleBadge;

  const affiliateGymDisplay =
    user.affiliateGym === OTHER_GYM
      ? `Other${user.affiliateGymOther ? ` — ${user.affiliateGymOther}` : ""}`
      : user.affiliateGym;

  const isKnownGym =
    user.affiliateGym != null &&
    (AFFILIATE_GYMS as readonly string[]).includes(user.affiliateGym);
  const gymPage = isKnownGym
    ? await prisma.gym.findUnique({ where: { name: user.affiliateGym! } })
    : null;
  const gymHref = gymPage ? `/gyms/${encodeURIComponent(gymPage.name)}` : undefined;

  const badges: ReactNode[] = [];
  if (user.level) {
    badges.push(
      <Badge key="level" label={LEVEL_LABELS[user.level]} className={LEVEL_BADGE_CLASSES[user.level]} />
    );
  }
  if (user.showAge && user.age != null) {
    badges.push(<Badge key="age" label={`${user.age} yrs`} className="bg-gray-100 text-gray-600" />);
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
  if (user.area) metaParts.push(<span key="area">{user.area}</span>);
  if (affiliateGymDisplay) {
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
  if (crossfitSince) metaParts.push(<span key="since">CrossFitting since {crossfitSince}</span>);

  return (
    <div className="flex flex-col gap-6">
      <SectionCard>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative h-28 w-28">
            {user.photo ? (
              <Image
                src={user.photo}
                alt={`${user.name}'s photo`}
                width={112}
                height={112}
                className="h-28 w-28 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-b2b-purple/10 text-3xl font-semibold text-b2b-purple">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            {showSingleBadge && (
              <span
                title="Single"
                className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-b2b-card text-base shadow"
              >
                💚
              </span>
            )}
          </div>

          <div>
            <p className="text-xl font-semibold">
              {user.name}
              {user.isPrivate && (
                <span className="ml-2 align-middle text-sm font-normal text-b2b-ink/50">🔒 Private</span>
              )}
            </p>
            {showEmail && <p className="text-sm text-b2b-ink/50">{user.email}</p>}
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

      <SectionCard title="Key PBs (kg)">
        {pbs.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pbs.map((pb) => (
              <div
                key={pb.label}
                className="rounded-lg border border-b2b-purple/10 bg-b2b-bg px-3 py-2"
              >
                <p className="text-xs text-b2b-ink/50">{pb.label}</p>
                <p className="mt-0.5 text-lg font-semibold text-b2b-ink">{pb.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-b2b-ink/40">Not set</p>
        )}
      </SectionCard>
    </div>
  );
}
