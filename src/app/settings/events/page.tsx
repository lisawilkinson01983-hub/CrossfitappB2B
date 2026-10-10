import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { EVENT_STATUS_BADGE_CLASSES, EVENT_STATUS_LABELS } from "@/lib/labels";
import { formatEventDate } from "@/lib/eventDate";
import { BackLink } from "@/components/BackLink";

export default async function EventSubmissionsSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const mySubmissions = await prisma.event.findMany({
    where: { submittedById: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <BackLink href="/settings" className="mt-6">Settings</BackLink>

      <div className="mt-4">
        <SectionCard
          title="Event submissions"
          action={
            <Link href="/events/submit" className="text-sm text-b2b-pink underline">
              Submit an event
            </Link>
          }
        >
          {mySubmissions.length === 0 ? (
            <p className="text-b2b-ink/40">You haven't submitted any events yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {mySubmissions.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-lg border border-b2b-purple/10 bg-b2b-bg p-3"
                >
                  <div>
                    <p className="font-medium">
                      {event.status === "APPROVED" ? (
                        <Link href={`/events/${event.id}`} className="hover:underline">
                          {event.name}
                        </Link>
                      ) : (
                        event.name
                      )}
                    </p>
                    <p className="text-sm text-b2b-ink/50">
                      {formatEventDate(event)} · {event.isOnline ? "Online" : event.location}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {event.isPrivate && (
                      <span className="whitespace-nowrap rounded-full bg-b2b-purple/10 px-2 py-0.5 text-xs font-medium text-b2b-purple">
                        🔒 Private
                      </span>
                    )}
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_STATUS_BADGE_CLASSES[event.status]}`}
                    >
                      {EVENT_STATUS_LABELS[event.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
