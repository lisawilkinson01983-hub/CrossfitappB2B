import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { EventClaimCard } from "@/components/EventClaimCard";
import { BackLink } from "@/components/BackLink";

export default async function EventClaimsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) notFound();

  const pending = await prisma.event.findMany({
    where: { claimRequestedById: { not: null } },
    orderBy: { claimRequestedAt: "asc" },
    select: {
      id: true,
      name: true,
      createdBy: { select: { name: true } },
      claimRequestedAt: true,
      claimRequestedBy: { select: { id: true, name: true, account: { select: { email: true } } } },
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <BackLink href="/settings/admin" className="mt-6">Back to settings</BackLink>

      <div className="mt-4">
        <SectionCard title={`${pending.length} claim ${pending.length === 1 ? "request" : "requests"}`}>
          {pending.length === 0 ? (
            <p className="text-b2b-ink/40">Nothing waiting on review.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map((event) => (
                <EventClaimCard
                  key={event.id}
                  claim={{
                    id: event.id,
                    name: event.name,
                    organizerName: event.createdBy?.name ?? "Unknown",
                    requestedBy: {
                      id: event.claimRequestedBy!.id,
                      name: event.claimRequestedBy!.name,
                      email: event.claimRequestedBy!.account?.email ?? "",
                    },
                    claimRequestedAt: event.claimRequestedAt!,
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
