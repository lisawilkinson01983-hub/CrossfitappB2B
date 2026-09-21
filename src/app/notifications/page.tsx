import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // Viewing this page marks everything on it as read.
  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      actor: { select: { id: true, name: true } },
      post: { select: { id: true } },
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <h1 className="mt-6 text-2xl font-bold">Notifications</h1>

      <div className="mt-6">
        <SectionCard>
          {notifications.length === 0 ? (
            <p className="text-b2b-ink/40">No notifications yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-b2b-purple/10">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.post ? `/feed#post-${n.post.id}` : `/profile/${n.actor.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:bg-b2b-purple/5"
                >
                  <p className="text-sm">
                    <span className="font-semibold">{n.actor.name}</span>{" "}
                    {n.type === "LIKE" ? "liked your post" : "commented on your post"}
                  </p>
                  <span className="whitespace-nowrap text-xs text-b2b-ink/40">
                    {n.createdAt.toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
