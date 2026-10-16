import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { BackLink } from "@/components/BackLink";
import { CleanupDeletedButton } from "./CleanupDeletedButton";

export default async function CleanupDeletedPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) notFound();

  const deletedUserCount = await prisma.user.count({ where: { deletedAt: { not: null } } });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <BackLink href="/settings/admin" className="mt-6">Admin</BackLink>

      <div className="mt-4">
        <SectionCard title="Clean up deleted users' content">
          <p className="text-sm text-b2b-ink/70">
            Deleting an account now fully removes everything it posted — feed posts, event message board posts, and
            comments it left anywhere — instead of leaving a "[deleted]" placeholder behind. This runs that same
            cleanup against every account already deleted before that change, on whichever database this button is
            running against.
          </p>
          <p className="mt-2 text-sm text-b2b-ink/50">
            {deletedUserCount} deleted {deletedUserCount === 1 ? "account" : "accounts"} on this database right now.
          </p>
          <div className="mt-4">
            <CleanupDeletedButton />
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
