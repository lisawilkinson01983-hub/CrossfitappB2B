import Image from "next/image";
import Link from "next/link";
import type { User } from "@prisma/client";
import {
  GENDER_LABELS,
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

function Field({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-b2b-ink/40">{label}</dt>
      <dd className="mt-0.5 text-b2b-ink">
        {value == null ? (
          <span className="text-b2b-ink/30">Not set</span>
        ) : href ? (
          <Link href={href} className="text-b2b-pink underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export async function ProfileDetails({ user, showEmail }: { user: User; showEmail: boolean }) {
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

  return (
    <div className="flex flex-col gap-6">
      <SectionCard>
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24">
            {user.photo ? (
              <Image
                src={user.photo}
                alt={`${user.name}'s photo`}
                width={96}
                height={96}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-b2b-purple/10 text-2xl font-semibold text-b2b-purple">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            {showSingleBadge && (
              <span
                title="Single"
                className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-b2b-card text-sm shadow"
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
            {showEmail && <p className="text-b2b-ink/50">{user.email}</p>}
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field label="Bio" value={user.bio} />
          {user.showAge && <Field label="Age" value={user.age != null ? String(user.age) : null} />}
          <Field label="Gender" value={user.gender ? GENDER_LABELS[user.gender] : null} />
          <Field label="Area" value={user.area} />
          <Field label="Affiliate gym" value={affiliateGymDisplay} href={gymHref} />
          <Field label="Level" value={user.level ? LEVEL_LABELS[user.level] : null} />
          <Field label="CrossFitting since" value={crossfitSince} />
          {user.showLookingFor && (
            <Field
              label="Looking for"
              value={lookingFor.length ? lookingFor.map((v) => LOOKING_FOR_LABELS[v]).join(", ") : null}
            />
          )}
          {showRelationshipStatus && (
            <Field label="Relationship status" value={user.isSingle ? "Single" : "Not single"} />
          )}
        </dl>
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
