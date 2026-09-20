import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  GENDER_LABELS,
  LEVEL_LABELS,
  LOOKING_FOR_LABELS,
  MONTH_NAMES,
  PB_LABELS,
  parseLookingFor,
} from "@/lib/labels";
import { PB_FIELDS } from "@/lib/validation";
import { SignOutButton } from "@/components/SignOutButton";
import { WorkoutCard } from "@/components/WorkoutCard";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-900">{value ?? <span className="text-gray-400">Not set</span>}</dd>
    </div>
  );
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const lookingFor = parseLookingFor(user.lookingFor);
  const crossfitSince =
    user.crossfitSinceYear != null
      ? `${user.crossfitSinceMonth ? MONTH_NAMES[user.crossfitSinceMonth - 1] + " " : ""}${user.crossfitSinceYear}`
      : null;

  const pbs = PB_FIELDS.map((field) => ({ label: PB_LABELS[field], value: user[field] })).filter(
    (pb) => pb.value != null
  );

  const showSingleBadge = user.isSingle === true && user.showSingleBadge;

  const recentWorkouts = await prisma.workout.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your profile</h1>
        <div className="flex gap-2">
          <Link
            href="/profile/edit"
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Edit profile
          </Link>
          <SignOutButton />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
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
              className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm shadow"
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
          <p className="text-gray-500">{user.email}</p>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="Bio" value={user.bio} />
        <Field label="Age" value={user.age != null ? String(user.age) : null} />
        <Field label="Gender" value={user.gender ? GENDER_LABELS[user.gender] : null} />
        <Field label="Area" value={user.area} />
        <Field label="Affiliate gym" value={user.affiliateGym} />
        <Field label="Level" value={user.level ? LEVEL_LABELS[user.level] : null} />
        <Field label="Weight (kg)" value={user.weightKg != null ? String(user.weightKg) : null} />
        <Field label="CrossFitting since" value={crossfitSince} />
        <Field
          label="Looking for"
          value={lookingFor.length ? lookingFor.map((v) => LOOKING_FOR_LABELS[v]).join(", ") : null}
        />
        <Field
          label="Single"
          value={user.isSingle == null ? null : user.isSingle ? "Yes" : "No"}
        />
      </dl>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-gray-500">Key PBs (kg)</h2>
        {pbs.length ? (
          <dl className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {pbs.map((pb) => (
              <div key={pb.label}>
                <dt className="text-xs text-gray-500">{pb.label}</dt>
                <dd className="text-gray-900">{pb.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-1 text-gray-400">Not set</p>
        )}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-500">Workout history</h2>
          <div className="flex gap-3 text-sm">
            <Link href="/workouts/new" className="text-blue-600 underline">
              Log a workout
            </Link>
            {recentWorkouts.length > 0 && (
              <Link href="/workouts" className="text-blue-600 underline">
                View all
              </Link>
            )}
          </div>
        </div>
        {recentWorkouts.length ? (
          <div className="mt-2 flex flex-col gap-3">
            {recentWorkouts.map((workout) => (
              <WorkoutCard key={workout.id} workout={workout} />
            ))}
          </div>
        ) : (
          <p className="mt-1 text-gray-400">No workouts logged yet.</p>
        )}
      </div>
    </main>
  );
}
