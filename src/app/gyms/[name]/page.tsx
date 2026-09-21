import Image from "next/image";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";

export default async function GymPage({ params }: { params: Promise<{ name: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { name } = await params;

  const gym = await prisma.gym.findUnique({ where: { name: decodeURIComponent(name) } });
  if (!gym) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <div className="mt-6 flex flex-col gap-6">
        <SectionCard>
          {gym.photo && (
            <Image
              src={gym.photo}
              alt={gym.name}
              width={600}
              height={280}
              className="mb-4 max-h-56 w-full rounded-lg object-cover"
            />
          )}
          <h1 className="text-2xl font-bold">{gym.name}</h1>

          {gym.description && <p className="mt-3 whitespace-pre-wrap text-b2b-ink/80">{gym.description}</p>}

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

          <Link
            href={`/discover?gym=${encodeURIComponent(gym.name)}`}
            className="mt-6 inline-block text-sm text-b2b-pink underline"
          >
            Browse athletes at {gym.name}
          </Link>
        </SectionCard>
      </div>
    </main>
  );
}
