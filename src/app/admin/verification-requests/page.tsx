import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { VerificationRequestCard } from "@/components/VerificationRequestCard";

export default async function VerificationRequestsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) notFound();

  const pending = await prisma.user.findMany({
    where: { accountType: "AFFILIATE", verificationRequestedAt: { not: null }, verifiedAt: null },
    orderBy: { verificationRequestedAt: "asc" },
    select: { id: true, name: true, email: true, affiliateGym: true, verificationRequestedAt: true },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href="/settings" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to settings
      </Link>

      <div className="mt-4">
        <SectionCard
          title={`${pending.length} verification ${pending.length === 1 ? "request" : "requests"}`}
        >
          {pending.length === 0 ? (
            <p className="text-b2b-ink/40">Nothing waiting on review.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map((request) => (
                <VerificationRequestCard
                  key={request.id}
                  request={{
                    id: request.id,
                    name: request.name,
                    email: request.email,
                    affiliateGym: request.affiliateGym,
                    verificationRequestedAt: request.verificationRequestedAt!,
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
