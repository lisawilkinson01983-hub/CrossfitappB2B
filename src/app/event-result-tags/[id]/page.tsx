import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { Avatar } from "@/components/Avatar";
import { resultHeadline } from "@/lib/eventResults";
import { EventResultTagActions } from "./EventResultTagActions";

export default async function EventResultTagPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const tag = await prisma.eventResultTag.findUnique({
    where: { id },
    include: {
      result: {
        include: {
          event: { select: { id: true, name: true, photo: true, location: true, isOnline: true } },
          loggedBy: { select: { id: true, name: true, photo: true } },
        },
      },
    },
  });
  if (!tag) notFound();
  if (tag.taggedUserId !== session.user.id) notFound();

  const { result } = tag;

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-28">
      <NavBar />

      <div className="mt-10 flex flex-col items-center gap-1 rounded-2xl bg-b2b-card p-6 text-center shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <Avatar photo={result.loggedBy.photo} name={result.loggedBy.name} size={30} />
          <span className="text-sm text-b2b-ink/50">{result.loggedBy.name} tagged you</span>
        </div>

        <div className="flex w-full gap-3 rounded-xl border border-b2b-pink/30 bg-b2b-pink/[0.06] p-3 text-left">
          {result.event.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.event.photo} alt="" className="h-[68px] w-[56px] shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex h-[68px] w-[56px] shrink-0 items-center justify-center rounded-lg bg-b2b-pink/15 text-2xl">
              🏆
            </div>
          )}
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-b2b-pink px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
              {resultHeadline(result)}
            </span>
            <p className="mt-1 font-display text-lg leading-tight text-b2b-ink">{result.event.name}</p>
            <p className="mt-0.5 text-xs text-b2b-ink/50">
              {result.division && `${result.division} · `}
              {result.event.isOnline ? "Online" : result.event.location}
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-b2b-ink/60">
          Add this result to your own profile and results board? It&rsquo;ll also appear in your feed, visible to
          your followers.
        </p>

        {tag.status !== "PENDING" ? (
          <p className="mt-4 text-sm font-semibold text-b2b-ink/50">
            {tag.status === "ACCEPTED" ? "You already added this to your profile." : "You already declined this tag."}
          </p>
        ) : (
          <div className="mt-4 w-full">
            <EventResultTagActions tagId={tag.id} />
          </div>
        )}
      </div>
    </main>
  );
}
