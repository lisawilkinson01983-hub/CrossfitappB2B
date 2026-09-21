import Image from "next/image";
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
import { OTHER_GYM } from "@/lib/gyms";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-b2b-ink">{value ?? <span className="text-gray-400">Not set</span>}</dd>
    </div>
  );
}

export function ProfileDetails({ user, showEmail }: { user: User; showEmail: boolean }) {
  const lookingFor = parseLookingFor(user.lookingFor);
  const crossfitSince =
    user.crossfitSinceYear != null
      ? `${user.crossfitSinceMonth ? MONTH_NAMES[user.crossfitSinceMonth - 1] + " " : ""}${user.crossfitSinceYear}`
      : null;

  const pbs = PB_FIELDS.map((field) => ({ label: PB_LABELS[field], value: user[field] })).filter(
    (pb) => pb.value != null
  );

  const showSingleBadge = user.isSingle === true && user.showSingleBadge;

  const affiliateGymDisplay =
    user.affiliateGym === OTHER_GYM
      ? `Other${user.affiliateGymOther ? ` — ${user.affiliateGymOther}` : ""}`
      : user.affiliateGym;

  return (
    <>
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
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-200 text-2xl font-semibold text-gray-500">
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
              <span className="ml-2 align-middle text-sm font-normal text-gray-500">🔒 Private</span>
            )}
          </p>
          {showEmail && <p className="text-gray-500">{user.email}</p>}
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="Bio" value={user.bio} />
        <Field label="Age" value={user.age != null ? String(user.age) : null} />
        <Field label="Gender" value={user.gender ? GENDER_LABELS[user.gender] : null} />
        <Field label="Area" value={user.area} />
        <Field label="Affiliate gym" value={affiliateGymDisplay} />
        <Field label="Level" value={user.level ? LEVEL_LABELS[user.level] : null} />
        <Field label="Weight (kg)" value={user.weightKg != null ? String(user.weightKg) : null} />
        <Field label="CrossFitting since" value={crossfitSince} />
        <Field
          label="Looking for"
          value={lookingFor.length ? lookingFor.map((v) => LOOKING_FOR_LABELS[v]).join(", ") : null}
        />
        <Field label="Single" value={user.isSingle == null ? null : user.isSingle ? "Yes" : "No"} />
      </dl>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-gray-500">Key PBs (kg)</h2>
        {pbs.length ? (
          <dl className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {pbs.map((pb) => (
              <div key={pb.label}>
                <dt className="text-xs text-gray-500">{pb.label}</dt>
                <dd className="text-b2b-ink">{pb.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-1 text-gray-400">Not set</p>
        )}
      </div>
    </>
  );
}
