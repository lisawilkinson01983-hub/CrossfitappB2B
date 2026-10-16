import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { BackLink } from "@/components/BackLink";
import { HidePrivateEventPostsButton } from "./HidePrivateEventPostsButton";

export default async function HidePrivateEventPostsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) notFound();

  const leakedCount = await prisma.post.count({ where: { sharedToFeed: true, linkedEvent: { isPrivate: true } } });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <BackLink href="/settings/admin" className="mt-6">Admin</BackLink>

      <div className="mt-4">
        <SectionCard title="Hide private-event posts from the feed">
          <p className="text-sm text-b2b-ink/70">
            Joining a private event used to post to the main feed the same as any other event — fixed so a private
            event's join post never shows up there, but posts made before that fix are still showing. This finds and
            hides them, on whichever database this button is running against.
          </p>
          <p className="mt-2 text-sm text-b2b-ink/50">
            {leakedCount} leaked {leakedCount === 1 ? "post" : "posts"} on this database right now.
          </p>
          <div className="mt-4">
            <HidePrivateEventPostsButton />
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
