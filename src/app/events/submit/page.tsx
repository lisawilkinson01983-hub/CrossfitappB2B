import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { EventSubmitForm } from "@/components/EventSubmitForm";

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export default async function SubmitEventPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const mySubmissions = await prisma.event.findMany({
    where: { submittedById: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href="/discover?view=events" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to events
      </Link>

      <div className="mt-4 flex flex-col gap-6">
        <SectionCard title="Submit an event">
          <EventSubmitForm />
        </SectionCard>

        {mySubmissions.length > 0 && (
          <SectionCard title="Your submissions">
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
                      {event.date.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {event.location}
                    </p>
                  </div>
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[event.status]}`}
                  >
                    {STATUS_LABEL[event.status]}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </main>
  );
}
