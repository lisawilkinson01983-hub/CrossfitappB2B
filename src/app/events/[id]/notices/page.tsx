import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { EventNoticeComposer } from "@/components/EventNoticeComposer";
import { EventNoticeCard } from "@/components/EventNoticeCard";

export default async function EventNoticesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      notices: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, photo: true } } },
      },
    },
  });
  if (!event) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href={`/events/${event.id}`} className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to {event.name}
      </Link>

      <div className="mt-4 flex flex-col gap-6">
        <SectionCard title="Post a notice">
          <p className="mb-3 text-sm text-b2b-ink/50">
            Looking for teammates, a lift, or a training partner for {event.name}? Post it here.
          </p>
          <EventNoticeComposer eventId={event.id} />
        </SectionCard>

        <SectionCard title={`${event.notices.length} ${event.notices.length === 1 ? "notice" : "notices"}`}>
          {event.notices.length === 0 ? (
            <p className="text-b2b-ink/40">No notices yet — be the first to post one.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {event.notices.map((notice) => (
                <EventNoticeCard
                  key={notice.id}
                  notice={{
                    id: notice.id,
                    text: notice.text,
                    createdAt: notice.createdAt,
                    author: notice.user,
                  }}
                  isOwn={notice.userId === session.user.id}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
