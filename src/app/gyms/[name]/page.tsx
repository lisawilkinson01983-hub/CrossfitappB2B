import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { Avatar } from "@/components/Avatar";

export default async function GymPage({ params }: { params: Promise<{ name: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { name } = await params;

  const gym = await prisma.gym.findUnique({ where: { name: decodeURIComponent(name) } });
  if (!gym) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href="/discover?view=affiliates" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to affiliates
      </Link>

      <div className="mt-4 flex flex-col gap-6">
        <SectionCard>
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar photo={gym.photo} name={gym.name} size={112} />
            <h1 className="text-2xl font-bold">{gym.name}</h1>

            <Link
              href={`/discover?gym=${encodeURIComponent(gym.name)}`}
              className="rounded bg-b2b-pink px-4 py-2 text-sm font-medium text-white hover:bg-b2b-pink-dark"
            >
              Browse athletes at {gym.name}
            </Link>
          </div>

          {gym.description && <p className="mt-6 whitespace-pre-wrap text-b2b-ink/80">{gym.description}</p>}

          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {gym.address && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-b2b-ink/40">Address</dt>
                <dd className="mt-0.5 text-b2b-ink">{gym.address}</dd>
              </div>
            )}
            {gym.website && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-b2b-ink/40">Website</dt>
                <dd className="mt-0.5">
                  <a
                    href={gym.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-b2b-pink underline"
                  >
                    {gym.website}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </SectionCard>
      </div>
    </main>
  );
}
