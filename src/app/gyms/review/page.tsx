import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { GymModerationCard } from "@/components/GymModerationCard";

export default async function GymReviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) notFound();

  const pending = await prisma.gym.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { submittedBy: { select: { id: true, name: true, email: true } } },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href="/discover?view=affiliates" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to affiliates
      </Link>

      <div className="mt-4">
        <SectionCard title={`${pending.length} ${pending.length === 1 ? "submission" : "submissions"} to review`}>
          {pending.length === 0 ? (
            <p className="text-b2b-ink/40">Nothing waiting on review.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map((gym) => (
                <GymModerationCard
                  key={gym.id}
                  gym={{
                    id: gym.id,
                    name: gym.name,
                    address: gym.address,
                    description: gym.description,
                    website: gym.website,
                    photo: gym.photo,
                    submittedBy: gym.submittedBy,
                  }}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
