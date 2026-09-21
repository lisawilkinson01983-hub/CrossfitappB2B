import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { BlockMuteControls } from "@/components/BlockMuteControls";
import { ChangeEmailForm } from "./ChangeEmailForm";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPrivate: true },
  });
  if (!user) redirect("/login");

  const [blocks, mutes] = await Promise.all([
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

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <NavBar />
      <h1 className="mt-6 text-2xl font-bold">Settings</h1>

      <section className="mt-6 rounded border border-gray-200 bg-b2b-card p-4">
        <h2 className="font-semibold">Account</h2>
        <p className="mt-1 text-sm">
          <Link href="/profile/edit" className="text-b2b-pink underline">
            Edit your profile
          </Link>
        </p>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <h3 className="text-sm font-medium text-gray-500">Change email</h3>
          <div className="mt-2">
            <ChangeEmailForm />
          </div>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <h3 className="text-sm font-medium text-gray-500">Change password</h3>
          <div className="mt-2">
            <ChangePasswordForm />
          </div>
        </div>
      </section>

      <section className="mt-6 rounded border border-gray-200 bg-b2b-card p-4">
        <h2 className="font-semibold">Privacy &amp; Safety</h2>

        <p className="mt-2 text-sm text-gray-600">
          Your profile is currently <strong>{user.isPrivate ? "private" : "public"}</strong>.{" "}
          <Link href="/profile/edit" className="text-b2b-pink underline">
            Change this
          </Link>
        </p>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <h3 className="text-sm font-medium text-gray-500">
            Blocked users ({blocks.length})
          </h3>
          {blocks.length === 0 ? (
            <p className="mt-1 text-sm text-gray-400">No one blocked.</p>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              {blocks.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <span>{b.blocked.name}</span>
                  <BlockMuteControls
                    targetUserId={b.blocked.id}
                    initialBlocked={true}
                    initialMuted={false}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <h3 className="text-sm font-medium text-gray-500">
            Muted accounts ({mutes.length})
          </h3>
          {mutes.length === 0 ? (
            <p className="mt-1 text-sm text-gray-400">No one muted.</p>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              {mutes.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span>{m.mutedUser.name}</span>
                  <BlockMuteControls
                    targetUserId={m.mutedUser.id}
                    initialBlocked={false}
                    initialMuted={true}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
