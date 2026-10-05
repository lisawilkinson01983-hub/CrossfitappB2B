import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { Avatar } from "@/components/Avatar";
import { GymBookingButtons } from "@/components/GymBookingButtons";
import { bookingMailto, findVerifiedGymOwner } from "@/lib/gymPages";

export default async function GymPage({ params }: { params: Promise<{ name: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { name } = await params;

  const [me, gym] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } }),
    prisma.gym.findUnique({
      where: { name: decodeURIComponent(name) },
      include: { claimedBy: { select: { photo: true } } },
    }),
  ]);
  if (!gym) notFound();

  // Only worth showing the buttons if there's somewhere for a booking to
  // actually go, and not to the affiliate viewing their own gym's page.
  const owner = gym.bookingEmail ? null : await findVerifiedGymOwner(gym.name);
  const canBook = (gym.bookingEmail != null || owner != null) && owner?.id !== session.user.id;

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <div className="mt-6 flex items-center justify-between">
        <Link href="/discover?view=affiliates" className="inline-block text-sm text-b2b-pink underline">
          ← Back to affiliates
        </Link>
        {me?.isAdmin && (
          <Link href={`/gyms/${encodeURIComponent(gym.name)}/edit`} className="text-sm text-b2b-purple underline">
            Edit affiliate
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-6">
        <SectionCard>
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar
              fallback="gym"
              photo={gym.claimedBy?.photo ?? gym.photo}
              name={gym.name}
              size={112}
              verified={Boolean(gym.claimedBy)}
            />
            <h1 className="text-2xl font-bold">{gym.name}</h1>

            <Link
              href={`/discover?gym=${encodeURIComponent(gym.name)}`}
              className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark"
            >
              Browse athletes at {gym.name}
            </Link>

            {gym.website && (
              <a
                href={gym.website}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-b2b-purple px-4 py-2 text-sm font-medium text-white hover:bg-b2b-purple-dark"
              >
                🌐 Visit website
              </a>
            )}

            {canBook &&
              (gym.bookingEmail ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <a
                    href={bookingMailto(gym.bookingEmail, "Intro Session", gym.name)}
                    className="rounded bg-b2b-purple px-4 py-2 text-sm font-medium text-white hover:bg-b2b-purple-dark"
                  >
                    Book an Intro Session
                  </a>
                  <a
                    href={bookingMailto(gym.bookingEmail, "Drop-in", gym.name)}
                    className="rounded bg-b2b-purple px-4 py-2 text-sm font-medium text-white hover:bg-b2b-purple-dark"
                  >
                    Book a Drop-in
                  </a>
                </div>
              ) : (
                <GymBookingButtons gymId={gym.id} />
              ))}
          </div>

          {gym.description && <p className="mt-6 whitespace-pre-wrap text-b2b-ink/80">{gym.description}</p>}

          {gym.address && (
            <dl className="mt-6">
              <dt className="text-xs font-medium uppercase tracking-wide text-b2b-ink/40">Address</dt>
              <dd className="mt-0.5 text-b2b-ink">{gym.address}</dd>
            </dl>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
