import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ParticipateButton } from "@/components/ParticipateButton";

export async function EventsList({ currentUserId }: { currentUserId: string }) {
  const events = await prisma.event.findMany({
    orderBy: { date: "asc" },
    include: { participants: { select: { userId: true } } },
  });

  return (
    <>
      {events.length === 0 ? (
        <p className="mt-6 text-b2b-ink/50">No events yet — check back soon.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {events.map((event) => {
            const isParticipating = event.participants.some((p) => p.userId === currentUserId);
            return (
              <div key={event.id} className="rounded-xl border border-b2b-purple/10 bg-b2b-card p-4">
                {event.photo && (
                  <Image
                    src={event.photo}
                    alt={event.name}
                    width={500}
                    height={260}
                    className="mb-3 max-h-52 w-full rounded-lg object-cover"
                  />
                )}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">
                      {event.name}
                      {event.tag && (
                        <span className="ml-2 rounded-full bg-b2b-purple/10 px-2 py-0.5 text-xs text-b2b-purple">
                          {event.tag}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-b2b-ink/50">
                      {event.date.toLocaleDateString(undefined, {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {event.location}
                    </p>
                  </div>
                  <ParticipateButton eventId={event.id} initialParticipating={isParticipating} />
                </div>
                {event.description && <p className="mt-2 text-sm text-b2b-ink/70">{event.description}</p>}
                <p className="mt-2 text-xs text-b2b-ink/40">
                  {event.participants.length}{" "}
                  {event.participants.length === 1 ? "athlete" : "athletes"} participating
                </p>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
