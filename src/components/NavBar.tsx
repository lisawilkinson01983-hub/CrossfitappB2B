import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "./Logo";
import { SignOutButton } from "./SignOutButton";

export async function NavBar() {
  const session = await getServerSession(authOptions);

  const unreadCount = session?.user?.id
    ? await prisma.message.count({
        where: {
          conversation: { OR: [{ userOneId: session.user.id }, { userTwoId: session.user.id }] },
          senderId: { not: session.user.id },
          readAt: null,
        },
      })
    : 0;

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-b2b-purple/10 pb-4">
      <Logo size="sm" href="/feed" />
      <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
        <Link href="/feed" className="text-b2b-ink/80 hover:text-b2b-pink">
          Feed
        </Link>
        <Link href="/discover" className="text-b2b-ink/80 hover:text-b2b-pink">
          Discover
        </Link>
        <Link href="/messages" className="flex items-center gap-1 text-b2b-ink/80 hover:text-b2b-pink">
          Messages
          {unreadCount > 0 && (
            <span className="rounded-full bg-b2b-pink px-1.5 py-0.5 text-xs font-medium text-white">
              {unreadCount}
            </span>
          )}
        </Link>
        <Link href="/profile" className="text-b2b-ink/80 hover:text-b2b-pink">
          Profile
        </Link>
        <Link href="/workouts" className="text-b2b-ink/80 hover:text-b2b-pink">
          Workouts
        </Link>
        <Link href="/settings" className="text-b2b-ink/80 hover:text-b2b-pink">
          Settings
        </Link>
        <SignOutButton />
      </div>
    </nav>
  );
}
