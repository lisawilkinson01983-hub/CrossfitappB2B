import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { EventModerationCard } from "@/components/EventModerationCard";
import { parseJsonArray } from "@/lib/labels";

export default async function EventReviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) notFound();

  const pending = await prisma.event.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { submittedBy: { select: { id: true, name: true, email: true } } },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href="/discover?view=events" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to events
      </Link>

      <div className="mt-4">
        <SectionCard title={`${pending.length} ${pending.length === 1 ? "submission" : "submissions"} to review`}>
          {pending.length === 0 ? (
            <p className="text-b2b-ink/40">Nothing waiting on review.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map((event) => (
                <EventModerationCard
                  key={event.id}
                  event={{
                    id: event.id,
                    name: event.name,
                    date: event.date,
                    endDate: event.endDate,
                    isOnline: event.isOnline,
                    location: event.location,
                    description: event.description,
                    websiteUrl: event.websiteUrl,
                    photo: event.photo,
                    division: parseJsonArray(event.division),
                    teamFormat: parseJsonArray(event.teamFormat),
                    genderCategory: parseJsonArray(event.genderCategory),
                    submittedBy: event.submittedBy,
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
