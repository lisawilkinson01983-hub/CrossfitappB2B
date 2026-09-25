import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { UNAFFILIATED } from "@/lib/gyms";
import { ComposeNoticeForm } from "./ComposeNoticeForm";

export default async function AdminNoticesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) notFound();

  const [approvedGyms, pastNotices] = await Promise.all([
    prisma.gym.findMany({ where: { status: "APPROVED" }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.notice.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { sentBy: { select: { name: true } } },
    }),
  ]);

  const gymOptions = [...approvedGyms.map((g) => g.name), UNAFFILIATED];

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />

      <Link href="/settings" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to settings
      </Link>

      <h1 className="mt-4 text-2xl font-bold">Send a notice</h1>
      <p className="mt-1 text-sm text-b2b-ink/60">
        Broadcasts a message from Box 2 Box to the notifications feed of everyone it matches. There's no
        undo once sent, so double check the audience count before sending.
      </p>

      <div className="mt-6">
        <SectionCard>
          <ComposeNoticeForm gymOptions={gymOptions} />
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title={`Previously sent (${pastNotices.length})`}>
          {pastNotices.length === 0 ? (
            <p className="text-sm text-b2b-ink/40">No notices sent yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-b2b-purple/10">
              {pastNotices.map((n) => (
                <div key={n.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{n.title}</p>
                    <span className="whitespace-nowrap text-xs text-b2b-ink/40">
                      {n.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-b2b-ink/70">{n.body}</p>
                  <p className="mt-1 text-xs text-b2b-ink/40">
                    Sent to {n.recipientCount} {n.recipientCount === 1 ? "person" : "people"} by {n.sentBy.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
