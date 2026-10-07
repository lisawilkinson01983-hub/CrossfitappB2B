import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { ManageMembersPanel } from "@/components/ManageMembersPanel";
import { conversationDisplayName } from "@/lib/conversations";

/**
 * A dedicated "admin" screen for a group's membership — deliberately
 * separate from the conversation header, so removing someone (or leaving)
 * takes a couple of considered taps on its own page rather than a single
 * accidental tap on an always-visible × next to their name.
 */
export default async function ManageMembersPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { conversationId } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, photo: true, deletedAt: true } } },
      },
    },
  });

  if (!conversation || !conversation.isGroup || !conversation.participants.some((p) => p.userId === session.user.id)) {
    notFound();
  }

  const displayName = conversationDisplayName(
    conversation,
    conversation.participants.filter((p) => p.userId !== session.user.id && !p.user.deletedAt).map((p) => p.user.name)
  );

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <Link href={`/messages/${conversationId}`} className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Back to {displayName}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Manage members</h1>

      <div className="mt-6">
        <ManageMembersPanel
          conversationId={conversationId}
          currentUserId={session.user.id}
          members={conversation.participants
            .filter((p) => !p.user.deletedAt)
            .map((p) => ({ id: p.userId, name: p.user.name, photo: p.user.photo }))}
        />
      </div>
    </main>
  );
}
