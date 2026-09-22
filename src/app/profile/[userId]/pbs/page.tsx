import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { PB_CATEGORIES, type PbField } from "@/lib/validation";
import { PB_LABELS, parseDisplayedPbs } from "@/lib/labels";

export default async function UserPbsPage({ params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { userId } = await params;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) notFound();

  // Same gate as the profile page itself: a private account's PBs are only
  // visible once we're an accepted follower (or it's our own page).
  if (userId !== session.user.id && user.isPrivate) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: session.user.id, followingId: userId } },
    });
    if (!follow) redirect(`/profile/${userId}`);
  }

  const displayedPbSet = new Set(parseDisplayedPbs(user.displayedPbs));

  const categories = PB_CATEGORIES.map((category) => ({
    label: category.label,
    entries: category.fields
      .map((field) => ({ field, value: user[field] }))
      .filter((entry): entry is { field: PbField; value: number } => entry.value != null),
  })).filter((category) => category.entries.length > 0);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href={`/profile/${userId}`} className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to profile
      </Link>

      <h1 className="mt-2 text-2xl font-bold">{user.name}&rsquo;s PBs</h1>

      <div className="mt-6 flex flex-col gap-4">
        {categories.length === 0 ? (
          <p className="text-b2b-ink/40">No PBs recorded yet.</p>
        ) : (
          categories.map((category) => (
            <SectionCard key={category.label} title={category.label}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {category.entries.map(({ field, value }) => (
                  <div
                    key={field}
                    className="rounded-lg border border-b2b-purple/10 bg-b2b-bg px-3 py-2"
                  >
                    <p className="text-xs text-b2b-ink/50">
                      {PB_LABELS[field]}
                      {displayedPbSet.has(field) && (
                        <span className="ml-1 text-b2b-pink" title="Featured on profile">
                          ★
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-lg font-semibold text-b2b-ink">{value}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          ))
        )}
      </div>
    </main>
  );
}
