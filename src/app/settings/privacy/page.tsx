import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { SectionCard } from "@/components/SectionCard";
import { BlockMuteControls } from "@/components/BlockMuteControls";

export default async function PrivacySettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [user, blocks, mutes] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { isPrivate: true } }),
    prisma.block.findMany({
      where: { blockerId: session.user.id },
      include: { blocked: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.mute.findMany({
      where: { userId: session.user.id },
      include: { mutedUser: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-28">
      <NavBar />
      <Link href="/settings" className="mt-6 inline-block text-sm text-b2b-pink underline">
        ← Settings
      </Link>

      <div className="mt-4">
        <SectionCard title="Privacy & Safety">
          <p className="text-sm text-b2b-ink/60">
            Your profile is currently <strong>{user.isPrivate ? "private" : "public"}</strong>.{" "}
            <Link href="/profile/edit" className="text-b2b-pink underline">
              Change this
            </Link>
          </p>

          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded-lg border border-b2b-purple/10 bg-b2b-bg p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">
                Blocked users ({blocks.length})
              </h3>
              {blocks.length === 0 ? (
                <p className="mt-1 text-sm text-b2b-ink/40">No one blocked.</p>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {blocks.map((b) => (
                    <div key={b.id} className="flex items-center justify-between text-sm">
                      <span>{b.blocked.name}</span>
                      <BlockMuteControls targetUserId={b.blocked.id} initialBlocked={true} initialMuted={false} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-b2b-purple/10 bg-b2b-bg p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-b2b-ink/50">
                Muted accounts ({mutes.length})
              </h3>
              {mutes.length === 0 ? (
                <p className="mt-1 text-sm text-b2b-ink/40">No one muted.</p>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {mutes.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <span>{m.mutedUser.name}</span>
                      <BlockMuteControls targetUserId={m.mutedUser.id} initialBlocked={false} initialMuted={true} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
